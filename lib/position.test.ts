import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculatePosition, maxSellable, OversellError, previewTrade } from "./position";
import { tradeInputSchema, type Trade } from "./trade-schema";

const seed: Trade[] = JSON.parse(readFileSync(join(process.cwd(), "data/trades.json"), "utf8"));

const cents = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.01, `${label}: expected ${expected}, got ${actual}`);

let n = 0;
const trade = (t: Partial<Trade> & Pick<Trade, "date" | "side" | "sol_amount" | "total_usd">): Trade => ({
  id: `t${++n}`,
  fee_usd: 0,
  quote_currency: "USD",
  quote_amount: null,
  fx_usd_per_quote: null,
  note: null,
  created_at: `${t.date}T00:00:00.000Z`,
  ...t,
});

test("seed data reproduces the known figures", () => {
  const p = calculatePosition(seed, 100);
  cents(p.avgCostBasis, 72.4725, "avgCostBasis");
  assert.equal(p.solHeld, 40);
  cents(p.totalCapitalDeployed, 7029.83, "totalCapitalDeployed");

  const [s1, s2] = p.sales;
  cents(s1.soldBasis, 2391.59, "sale 1 basis");
  cents(s1.realizedPL, 967.97, "sale 1 P/L");
  cents(s1.realizedPct, 40.47, "sale 1 %");
  cents(s2.soldBasis, 1739.34, "sale 2 basis");
  cents(s2.realizedPL, 660.66, "sale 2 P/L");
  cents(s2.realizedPct, 37.98, "sale 2 %");

  cents(p.realizedPL, 1628.63, "realizedPL");
  cents(p.totalRealizedCash, 5759.56, "totalRealizedCash");
  cents(p.remainingCostBasis, 2898.9, "remainingCostBasis");
  cents(p.breakEvenPrice, 31.76, "breakEvenPrice");
});

test("total P/L identity holds", () => {
  for (const price of [0, 50, 72.47, 100, 250]) {
    const p = calculatePosition(seed, price);
    cents(p.totalPL, p.totalPortfolioValue - p.totalCapitalDeployed, `identity @ ${price}`);
    cents(p.unrealizedValue, 40 * price, `unrealizedValue @ ${price}`);
  }
});

test("sells don't change avg cost; a buy after a sale re-averages from remaining basis", () => {
  const after = calculatePosition(
    [...seed, trade({ date: "2026-09-30", side: "buy", sol_amount: 10, total_usd: 1000 })],
    100,
  );
  cents(after.avgCostBasis, 77.98, "moving average"); // not 75.05 (average of all buys ever)
  assert.equal(after.solHeld, 50);
});

test("selling more than held throws OversellError", () => {
  assert.throws(
    () => calculatePosition([...seed, trade({ date: "2026-09-30", side: "sell", sol_amount: 41, total_usd: 4100 })], 100),
    OversellError,
  );
});

test("a back-dated sell that oversells at its own date throws even if current holdings cover it", () => {
  const ledger = [
    trade({ date: "2026-06-01", side: "buy", sol_amount: 10, total_usd: 700 }),
    trade({ date: "2026-07-01", side: "buy", sol_amount: 100, total_usd: 7000 }),
  ];
  assert.throws(
    () => calculatePosition([...ledger, trade({ date: "2026-06-15", side: "sell", sol_amount: 20, total_usd: 1600 })], 80),
    OversellError,
  );
});

test("deleting a buy that a later sell depends on is rejected", () => {
  const withoutBuys = seed.filter((t) => t.side !== "buy");
  assert.throws(() => calculatePosition(withoutBuys, 100), OversellError);
});

test("storage order doesn't matter", () => {
  const a = calculatePosition(seed, 100);
  const b = calculatePosition([...seed].reverse(), 100);
  assert.deepEqual(a, b);
});

test("previewTrade reports before/after and oversells", () => {
  const buy = previewTrade(seed, trade({ date: "2026-09-30", side: "buy", sol_amount: 10, total_usd: 1000 }), 100);
  assert.ok(buy.ok);
  cents(buy.before.avgCostBasis, 72.47, "before");
  cents(buy.after.avgCostBasis, 77.98, "after");

  const sell = previewTrade(seed, trade({ date: "2026-09-30", side: "sell", sol_amount: 50, total_usd: 5000 }), 100);
  assert.equal(sell.ok, false);
});

test("maxSellable respects later sells", () => {
  cents(maxSellable(seed, "2026-09-30"), 40, "today");
  // On Aug 28, 64 SOL are held, but the Sep 22 sale of 24 needs to stay covered.
  cents(maxSellable(seed, "2026-08-28"), 40, "back-dated");
  cents(maxSellable(seed, "2026-07-01"), 40, "before first sale");
  cents(maxSellable(seed, "2026-07-01", "2026-09-22-sell-2"), 64, "editing sale 2");
});

test("schema rejects zero, negative and non-numeric amounts", () => {
  const valid = {
    date: "2026-09-30", side: "buy", sol_amount: 1, total_usd: 100, fee_usd: 0,
    quote_currency: "USD", quote_amount: null, fx_usd_per_quote: null, note: null,
  };
  assert.ok(tradeInputSchema.safeParse(valid).success);
  for (const sol_amount of [0, -1, Number.NaN, "5"]) {
    assert.equal(tradeInputSchema.safeParse({ ...valid, sol_amount }).success, false, `sol_amount=${sol_amount}`);
  }
  assert.equal(tradeInputSchema.safeParse({ ...valid, quote_currency: "SGD" }).success, false, "SGD without amount");
});
