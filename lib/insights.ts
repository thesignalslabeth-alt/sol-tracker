// Plain observations computed from one user's own ledger. No I/O, no opinions:
// every line is a fact you could work out from the trade list by hand.
// Deliberately never a recommendation to buy, sell or hold.
import type { AssetPosition } from "./position";
import { clampThreshold, DEFAULT_PREFS } from "./prefs";
import { sortTrades } from "./position";
import type { Trade } from "./trade-schema";

export type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: "neutral" | "gain" | "loss";
  /** Shown in the callout at the top of the panel rather than the plain list. */
  highlight?: boolean;
};

/** The idea behind the 2x callout, stated once and named, so it isn't a bare number. */
export const CAPITAL_PRESERVATION =
  "Capital preservation: selling just enough to take your original stake back out, so the money you " +
  "started with is yours again and only profit stays in the market. It's a common way to cap the " +
  "downside on a position that has run up. Whether it suits you is your call.";

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const round = (n: number) => Math.round(n * 100) / 100;

/** Whole days between two YYYY-MM-DD dates. */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export type InsightInput = {
  trades: readonly Trade[];
  positions: readonly AssetPosition[];
  /** Today in the user's timezone, YYYY-MM-DD. */
  today: string;
  /**
   * The user's own line: flag a holding once it's worth this multiple of the cost
   * still in it. Defaults to 2 when the setting hasn't been touched.
   */
  threshold?: number;
};

/**
 * Facts worth surfacing about a ledger, most useful first. Returns [] for an empty
 * ledger. Value-based facts are skipped when a held asset has no live price, since
 * the totals would silently understate the portfolio.
 */
export function buildInsights({ trades, positions, today, threshold }: InsightInput): Insight[] {
  const multipleWanted = clampThreshold(threshold ?? DEFAULT_PREFS.capitalThreshold);
  if (trades.length === 0 || positions.length === 0) return [];
  const out: Insight[] = [];

  const held = positions.filter((p) => p.position.held > 0);
  const priced = held.every((p) => p.price != null);
  const heldValue = held.reduce((s, p) => s + p.position.unrealizedValue, 0);

  // 1. Concentration: how much of what you hold sits in one coin.
  if (priced && held.length > 1 && heldValue > 0) {
    const top = [...held].sort((a, b) => b.position.unrealizedValue - a.position.unrealizedValue)[0];
    const share = pct(top.position.unrealizedValue, heldValue);
    out.push({
      id: "concentration",
      title: `${top.asset} is ${round(share)}% of what you hold`,
      detail: `${usd(top.position.unrealizedValue)} of ${usd(heldValue)} across ${held.length} coins, at today's prices.`,
      tone: "neutral",
    });
  }

  // 2. Positions past the user's own multiple, with the arithmetic for taking
  // the original money back out. A calculation, not a suggestion to sell.
  for (const p of [...held].sort((a, b) => b.position.unrealizedValue - a.position.unrealizedValue)) {
    const { unrealizedValue, remainingCostBasis, held: qty } = p.position;
    if (p.price == null || remainingCostBasis <= 0) continue;
    const multiple = unrealizedValue / remainingCostBasis;
    if (multiple < multipleWanted) continue;
    const toRecover = Math.min(qty, remainingCostBasis / p.price);
    out.push({
      id: `doubled-${p.asset}`,
      title: `${p.asset} is worth ${round(multiple)}× what you still have in it`,
      detail:
        `${trim(qty)} ${p.asset} at ${price(p.price)} is ${usd(unrealizedValue)}, against ${usd(remainingCostBasis)} of cost. ` +
        `Selling ${trim(round8(toRecover))} ${p.asset} at today's price returns that ${usd(remainingCostBasis)}, ` +
        `leaving ${trim(round8(qty - toRecover))} ${p.asset} held at no remaining cost.`,
      tone: "gain",
      highlight: true,
    });
  }

  // 3. Realized vs unrealized: how much of the profit is banked and how much is on paper.
  const realized = positions.reduce((s, p) => s + p.position.realizedPL, 0);
  const unrealized = priced ? positions.reduce((s, p) => s + p.position.unrealizedPL, 0) : 0;
  if (priced && (realized !== 0 || unrealized !== 0)) {
    const total = realized + unrealized;
    const onPaper = pct(Math.abs(unrealized), Math.abs(realized) + Math.abs(unrealized));
    out.push({
      id: "realized-split",
      title: `${signed(realized)} banked, ${signed(unrealized)} on paper`,
      detail:
        `${round(onPaper)}% of your ${total >= 0 ? "profit" : "loss"} so far is unrealized: it moves with the price ` +
        `until you sell. Total ${signed(total)}.`,
      tone: total >= 0 ? "gain" : "loss",
    });
  }

  // 4. Cost basis vs price, per held coin (biggest holding first).
  for (const p of [...held].sort((a, b) => b.position.unrealizedValue - a.position.unrealizedValue).slice(0, 3)) {
    if (p.price == null || p.position.avgCostBasis <= 0) continue;
    const diff = pct(p.price - p.position.avgCostBasis, p.position.avgCostBasis);
    out.push({
      id: `cost-${p.asset}`,
      title: `${p.asset} is ${round(Math.abs(diff))}% ${diff >= 0 ? "above" : "below"} your average cost`,
      detail: `You hold ${trim(p.position.held)} ${p.asset} at an average cost of ${price(p.position.avgCostBasis)}; the price is ${price(p.price)}.`,
      tone: diff >= 0 ? "gain" : "loss",
    });
  }

  // 5. Fees, which are easy to forget once they're inside each trade.
  const fees = trades.reduce((s, t) => s + t.fee_usd, 0);
  const deployed = positions.reduce((s, p) => s + p.position.totalCapitalDeployed, 0);
  if (fees > 0) {
    out.push({
      id: "fees",
      title: `${usd(fees)} paid in fees`,
      detail: `Across ${trades.length} ${trades.length === 1 ? "trade" : "trades"}, that's ${round(pct(fees, deployed))}% of the ${usd(deployed)} you've put in.`,
      tone: "neutral",
    });
  }

  // 6. Closed positions: coins you no longer hold.
  const closed = positions.filter((p) => p.position.held === 0);
  if (closed.length > 0) {
    const closedPL = closed.reduce((s, p) => s + p.position.realizedPL, 0);
    out.push({
      id: "closed",
      title: `${closed.length} ${closed.length === 1 ? "coin" : "coins"} fully sold`,
      detail: `${closed.map((p) => p.asset).join(", ")} — ${signed(closedPL)} realized, nothing still held.`,
      tone: closedPL >= 0 ? "gain" : "loss",
    });
  }

  // 7. Last entry, so a ledger that's drifted out of date says so.
  const last = sortTrades(trades).at(-1);
  if (last) {
    const days = daysBetween(last.date, today);
    if (days >= 30) {
      out.push({
        id: "stale-ledger",
        title: `No trades logged for ${days} days`,
        detail: `Your last entry is a ${last.side} of ${last.asset} on ${last.date}. Anything traded since then is missing from these numbers.`,
        tone: "neutral",
      });
    }
  }

  return out;
}

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd = (n: number) => usdFmt.format(n);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usdFmt.format(Math.abs(n))}`;
const price = (n: number) =>
  n >= 1 ? usdFmt.format(n) : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(n);
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;
const trim = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(n);
