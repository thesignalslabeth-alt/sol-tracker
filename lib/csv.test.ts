import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parseTradesCsv, splitPair, toSgDate, toTemplateCsv } from "./csv";
import type { Trade } from "./trade-schema";

const close = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);

test("amount, pair and date helpers", () => {
  assert.deepEqual(parseAmount("1,234.5SOL"), { n: 1234.5, unit: "SOL" });
  assert.deepEqual(parseAmount("0.00012 BNB"), { n: 0.00012, unit: "BNB" });
  assert.deepEqual(splitPair("SOLUSDT"), { base: "SOL", quote: "USDT" });
  assert.deepEqual(splitPair("ETHFDUSD"), { base: "ETH", quote: "FDUSD" });
  assert.deepEqual(splitPair("BTC/USDC"), { base: "BTC", quote: "USDC" });
  assert.deepEqual(splitPair("ETHBTC"), { base: "ETH", quote: "BTC" });
  // 20:00 UTC on Aug 27 is Aug 28 in Singapore
  assert.equal(toSgDate("2026-08-27 20:00:00")?.date, "2026-08-28");
  assert.equal(toSgDate("2026-08-28 02:00:00", 8)?.createdAt, "2026-08-27T18:00:00.000Z");
});

test("template CSV round-trips, including SGD", () => {
  const trades: Trade[] = [
    { id: "a", date: "2026-08-01", asset: "SOL", side: "buy", quantity: 97, total_usd: 7029.83, fee_usd: 0, quote_currency: "USD", quote_amount: null, fx_usd_per_quote: null, note: "agg", created_at: "2026-08-01T00:00:00Z" },
    { id: "b", date: "2026-08-27", asset: "SOL", side: "sell", quantity: 33, total_usd: 3359.56, fee_usd: 0, quote_currency: "SGD", quote_amount: 4270, fx_usd_per_quote: 0.786782, note: null, created_at: "2026-08-27T00:00:00Z" },
  ];
  const res = parseTradesCsv(toTemplateCsv(trades));
  assert.equal(res.format, "template");
  if (res.format !== "template") return;
  assert.equal(res.rows.length, 2);
  assert.ok(res.rows.every((r) => r.input && !r.error));
  close(res.rows[1].input!.total_usd, 3359.56, "SGD total converted");
  assert.equal(res.rows[1].input!.quote_amount, 4270);
});

test("Binance trade history with coin-suffixed amounts and fees", () => {
  const csv = [
    '"Date(UTC)","Pair","Side","Price","Executed","Amount","Fee"',
    '"2026-08-01 03:00:00","SOLUSDT","BUY","70","10SOL","700USDT","0.01SOL"',
    '"2026-08-02 03:00:00","BTCUSDT","BUY","80000","0.01BTC","800USDT","0.0003BNB"',
    '"2026-08-03 03:00:00","SOLUSDT","SELL","100","5SOL","500USDT","0.5USDT"',
    '"2026-08-04 03:00:00","ETHBTC","BUY","0.03","1ETH","0.03BTC","0.001ETH"',
  ].join("\n");
  const res = parseTradesCsv(csv, new Set(["SOL", "BTC", "ETH"]));
  assert.equal(res.format, "binance");
  if (res.format !== "binance") return;
  const [solBuy, btcBuy, solSell, ethBtc] = res.rows;

  close(solBuy.input!.quantity, 9.99, "base fee reduces SOL received");
  close(solBuy.input!.total_usd, 700, "buy cost");
  assert.equal(solBuy.input!.asset, "SOL");
  assert.equal(solBuy.createdAt, "2026-08-01T03:00:00.000Z");

  assert.match(btcBuy.warning ?? "", /BNB/);
  close(btcBuy.input!.quantity, 0.01, "BNB fee leaves quantity");

  close(solSell.input!.total_usd, 499.5, "USDT fee reduces proceeds");
  assert.equal(solSell.input!.side, "sell");

  assert.ok(ethBtc.error?.includes("USD-stablecoin"), "non-USD quote rejected");
});

test("Binance order history: Side preferred over Type, unfilled rows skipped", () => {
  const csv = [
    "Date(UTC+8),OrderNo,Pair,Type,Side,Order Price,Order Amount,Executed,Average Price,Trading total,Status",
    "2026-09-01 10:00:00,1,ETHUSDT,LIMIT,BUY,2500,1,1ETH,2500,2500USDT,FILLED",
    "2026-09-02 10:00:00,2,ETHUSDT,LIMIT,SELL,3000,1,0ETH,0,0USDT,CANCELED",
  ].join("\n");
  const res = parseTradesCsv(csv);
  assert.equal(res.format, "binance");
  if (res.format !== "binance") return;
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].input!.side, "buy");
  assert.equal(res.rows[0].createdAt, "2026-09-01T02:00:00.000Z", "UTC+8 offset applied");
});

test("unknown asset and unrecognised files are reported", () => {
  const res = parseTradesCsv("date,asset,side,quantity,total\n2026-09-01,NOTACOIN,buy,1,10", new Set(["SOL"]));
  assert.ok(res.format === "template" && res.rows[0].error?.includes("no USDT pair"));
  const bad = parseTradesCsv("foo,bar\n1,2");
  assert.equal(bad.format, null);
});

test("fingerprints are stable so re-imports can be de-duplicated", () => {
  const csv = "date,asset,side,quantity,total\n2026-09-01,SOL,buy,1,100";
  const a = parseTradesCsv(csv);
  const b = parseTradesCsv(csv);
  assert.ok(a.format && b.format);
  if (a.format && b.format) assert.equal(a.rows[0].fingerprint, b.rows[0].fingerprint);
});

test("any supported currency imports, and the old fx_usd_per_sgd column still works", () => {
  const res = parseTradesCsv(
    [
      "date,asset,side,quantity,total,currency,fx_usd_per_quote,total_usd,fee,note",
      "2026-09-02,BTC,buy,0.01,3480,MYR,0.2451,,,",
      "2026-09-03,ETH,buy,1,45000000,IDR,0.0000559,,,",
      "2026-09-04,SOL,buy,1,100,EUR,1.1,,,",
    ].join("\n"),
  );
  assert.equal(res.format, "template");
  if (res.format !== "template") return;
  close(res.rows[0].input!.total_usd, 3480 * 0.2451, "MYR converted");
  assert.equal(res.rows[0].input!.quote_currency, "MYR");
  close(res.rows[1].input!.total_usd, 45000000 * 0.0000559, "IDR converted");
  assert.ok(res.rows[2].error, "unsupported currency rejected");

  const legacy = parseTradesCsv("date,asset,side,quantity,total,currency,fx_usd_per_sgd\n2026-08-27,SOL,sell,33,4270,SGD,0.786782");
  assert.ok(legacy.format === "template" && legacy.rows[0].input);
  if (legacy.format === "template") close(legacy.rows[0].input!.total_usd, 4270 * 0.786782, "legacy SGD column");
});

test("MYR trades round-trip through export", () => {
  const t: Trade = { id: "m", date: "2026-09-02", asset: "BTC", side: "buy", quantity: 0.01, total_usd: 852.95, fee_usd: 0, quote_currency: "MYR", quote_amount: 3480, fx_usd_per_quote: 0.2451, note: null, created_at: "2026-09-02T00:00:00Z" };
  const res = parseTradesCsv(toTemplateCsv([t]));
  assert.ok(res.format === "template");
  if (res.format !== "template") return;
  const back = res.rows[0].input!;
  assert.equal(back.quote_currency, "MYR");
  assert.equal(back.quote_amount, 3480);
  close(back.total_usd, 852.95, "exact USD total kept");
});
