// CSV import/export. Pure (no I/O) so it runs in the browser for previews and in tests.
import Papa from "papaparse";
import { tradeInputSchema, type Trade, type TradeInput } from "./trade-schema";

export type CsvFormat = "template" | "binance";

export type ParsedRow = {
  line: number; // 1-based line in the file, header = 1
  /** Stable identity of the source row, used to skip rows already imported. */
  fingerprint: string;
  input?: TradeInput;
  /** Exact trade time when the source has one (orders same-day trades correctly). */
  createdAt?: string;
  error?: string;
  warning?: string;
};

export type ParseResult = { format: CsvFormat; rows: ParsedRow[] } | { format: null; error: string };

// total is in `currency`; total_usd (optional on import) keeps the exact USD value of SGD trades.
export const TEMPLATE_HEADERS = ["date", "asset", "side", "quantity", "total", "currency", "fx_usd_per_sgd", "total_usd", "fee", "note"] as const;

// Quote assets valued 1:1 with USD. Other quotes (BTC, BNB, EUR…) would need a
// historical conversion rate, which Binance's export doesn't include.
const USD_QUOTES = ["FDUSD", "USDT", "USDC", "BUSD", "TUSD", "USDP", "DAI", "USD"];
const OTHER_QUOTES = ["BTC", "ETH", "BNB", "EUR", "TRY", "BRL", "JPY", "AUD", "GBP", "SOL"];
const QUOTES = [...USD_QUOTES, ...OTHER_QUOTES].sort((a, b) => b.length - a.length);

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_]+/g, " ");

/** "1,234.5SOL" → { n: 1234.5, unit: "SOL" }. */
export function parseAmount(raw: string | undefined): { n: number; unit: string } {
  const m = (raw ?? "").trim().replace(/,/g, "").match(/^(-?[\d.]+(?:e-?\d+)?)\s*([A-Za-z0-9]*)$/i);
  return m ? { n: Number(m[1]), unit: m[2].toUpperCase() } : { n: Number.NaN, unit: "" };
}

export function splitPair(pair: string): { base: string; quote: string } | null {
  const p = pair.trim().toUpperCase();
  const sep = p.match(/^([A-Z0-9]+)[/\-_ ]([A-Z0-9]+)$/);
  if (sep) return { base: sep[1], quote: sep[2] };
  const quote = QUOTES.find((q) => p.endsWith(q) && p.length > q.length);
  return quote ? { base: p.slice(0, -quote.length), quote } : null;
}

/** "2026-08-27 10:15:30" in UTC+offsetHours → ISO timestamp + Singapore calendar date. */
export function toSgDate(raw: string, offsetHours = 0): { date: string; createdAt: string } | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h - offsetHours, +mi, +s);
  if (Number.isNaN(ms)) return null;
  const at = new Date(ms);
  return { date: at.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }), createdAt: at.toISOString() };
}

function fingerprintOf(row: Record<string, string>) {
  return Object.keys(row)
    .sort()
    .map((k) => `${norm(k)}=${(row[k] ?? "").trim()}`)
    .join("|");
}

function finish(line: number, row: Record<string, string>, draft: unknown, extra: Partial<ParsedRow>, known?: Set<string>): ParsedRow {
  const base: ParsedRow = { line, fingerprint: fingerprintOf(row), ...extra };
  const r = tradeInputSchema.safeParse(draft);
  if (!r.success) return { ...base, error: r.error.issues.map((i) => i.message).join("; ") };
  if (known && known.size && !known.has(r.data.asset)) {
    return { ...base, error: `${r.data.asset} has no USDT pair on Binance` };
  }
  return { ...base, input: r.data };
}

function parseTemplateRow(line: number, row: Record<string, string>, known?: Set<string>): ParsedRow {
  const get = (k: string) => (row[k] ?? "").trim();
  const currency = (get("currency") || "USD").toUpperCase();
  const fx = currency === "SGD" ? Number(get("fx_usd_per_sgd")) : 1;
  const total = Number(get("total").replace(/,/g, ""));
  const exactUsd = get("total_usd") ? Number(get("total_usd").replace(/,/g, "")) : null;
  const fee = get("fee") ? Number(get("fee").replace(/,/g, "")) : 0;
  const draft = {
    date: get("date"),
    asset: get("asset"),
    side: get("side").toLowerCase(),
    quantity: Number(get("quantity").replace(/,/g, "")),
    total_usd: exactUsd ?? total * fx,
    fee_usd: fee * fx,
    quote_currency: currency,
    quote_amount: currency === "SGD" ? total : null,
    fx_usd_per_quote: currency === "SGD" ? fx : null,
    note: get("note") || null,
  };
  return finish(line, row, draft, {}, known);
}

type BinanceCols = {
  date: string;
  offset: number;
  pair: string;
  side: string;
  price?: string;
  qty: string;
  total?: string;
  fee?: string;
  feeCoin?: string;
  status?: string;
};

function binanceColumns(headers: string[]): BinanceCols | null {
  const find = (...names: string[]) => headers.find((h) => names.includes(norm(h)));
  const dateCol = headers.find((h) => /^(date|time)/.test(norm(h)));
  const pair = find("pair", "market", "symbol");
  // Order-history exports have both "Type" (LIMIT/MARKET) and "Side"; prefer Side.
  const side = find("side") ?? find("type");
  const executed = find("executed", "filled", "quantity");
  const qty = executed ?? find("amount");
  if (!dateCol || !pair || !side || !qty) return null;
  const offset = Number(dateCol.match(/UTC\s*([+-]\s*\d+)/i)?.[1]?.replace(/\s/g, "") ?? 0);
  return {
    date: dateCol,
    offset,
    pair,
    side,
    price: find("price", "average price", "avg trading price", "avgtrading price"),
    qty,
    // With an "Executed" column, Binance's "Amount" is the quote-currency total.
    total: executed ? find("amount", "total", "trading total") : find("total", "trading total"),
    fee: find("fee"),
    feeCoin: find("fee coin", "fee asset"),
    status: find("status"),
  };
}

function parseBinanceRow(line: number, row: Record<string, string>, c: BinanceCols, known?: Set<string>): ParsedRow | null {
  const fp = fingerprintOf(row);
  const fail = (error: string): ParsedRow => ({ line, fingerprint: fp, error });

  const status = c.status ? (row[c.status] ?? "").trim().toUpperCase() : "";
  if (status && !status.includes("FILLED")) return null; // cancelled/expired orders: skip silently

  const pair = splitPair(row[c.pair] ?? "");
  if (!pair) return fail(`Can't read pair "${row[c.pair]}"`);
  if (!USD_QUOTES.includes(pair.quote)) {
    return fail(`${pair.base}/${pair.quote}: only USD-stablecoin pairs (USDT, USDC, FDUSD…) can be imported`);
  }

  const when = toSgDate(row[c.date] ?? "", c.offset);
  if (!when) return fail(`Can't read date "${row[c.date]}"`);

  const side = (row[c.side] ?? "").trim().toLowerCase();
  if (side !== "buy" && side !== "sell") return fail(`Side must be BUY or SELL, got "${row[c.side]}"`);

  let qty = parseAmount(row[c.qty]).n;
  if (!(qty > 0)) return null; // unfilled order rows
  const price = c.price ? parseAmount(row[c.price]).n : Number.NaN;
  let total = c.total ? parseAmount(row[c.total]).n : Number.NaN;
  if (!(total > 0)) total = price * qty;

  // Fees: in the base asset they reduce what a buy received; in a USD quote they
  // reduce sale proceeds (or add to a buy's cost); in BNB etc. they can't be priced.
  let feeUsd = 0;
  let warning: string | undefined;
  const fee = c.fee ? parseAmount(row[c.fee]) : { n: 0, unit: "" };
  const feeCoin = (c.feeCoin ? (row[c.feeCoin] ?? "").trim().toUpperCase() : "") || fee.unit;
  if (fee.n > 0) {
    if (feeCoin === pair.base) {
      if (side === "buy") qty -= fee.n;
      feeUsd = fee.n * (total / parseAmount(row[c.qty]).n);
    } else if (USD_QUOTES.includes(feeCoin)) {
      total = side === "buy" ? total + fee.n : total - fee.n;
      feeUsd = fee.n;
    } else if (feeCoin) {
      warning = `Fee of ${fee.n} ${feeCoin} not included in cost basis`;
    }
  }

  const draft = {
    date: when.date,
    asset: pair.base,
    side,
    quantity: qty,
    total_usd: total,
    fee_usd: feeUsd,
    quote_currency: "USD",
    quote_amount: null,
    fx_usd_per_quote: null,
    note: `Binance ${pair.base}${pair.quote}`,
  };
  return finish(line, row, draft, { createdAt: when.createdAt, warning }, known);
}

/** Detects the format from the header row and parses every data row. */
export function parseTradesCsv(text: string, knownAssets?: Set<string>): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const headers = parsed.meta.fields ?? [];
  if (!headers.length || !parsed.data.length) return { format: null, error: "The file has no rows." };

  const normed = headers.map(norm);
  if (["date", "asset", "side", "quantity", "total"].every((h) => normed.includes(h))) {
    return { format: "template", rows: parsed.data.map((row, i) => parseTemplateRow(i + 2, row, knownAssets)) };
  }

  const cols = binanceColumns(headers);
  if (cols) {
    const rows = parsed.data
      .map((row, i) => parseBinanceRow(i + 2, row, cols, knownAssets))
      .filter((r): r is ParsedRow => r !== null);
    return { format: "binance", rows };
  }

  return {
    format: null,
    error: `Unrecognised columns: ${headers.join(", ")}. Use the template or a Binance spot trade history export.`,
  };
}

/** Trades → template CSV (re-importable). */
export function toTemplateCsv(trades: readonly Trade[]): string {
  const rows = trades.map((t) => {
    const sgd = t.quote_currency === "SGD" && t.quote_amount != null && t.fx_usd_per_quote != null;
    const fx = sgd ? t.fx_usd_per_quote! : 1;
    return {
      date: t.date,
      asset: t.asset,
      side: t.side,
      quantity: t.quantity,
      total: sgd ? t.quote_amount : t.total_usd,
      currency: t.quote_currency,
      fx_usd_per_sgd: sgd ? t.fx_usd_per_quote : "",
      total_usd: t.total_usd,
      fee: t.fee_usd ? +(t.fee_usd / fx).toFixed(8) : "",
      note: t.note ?? "",
    };
  });
  return Papa.unparse({ fields: [...TEMPLATE_HEADERS], data: rows.map((r) => TEMPLATE_HEADERS.map((h) => r[h])) });
}
