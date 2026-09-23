import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, CAPITAL_PRESERVATION, type Insight } from "./insights";
import { positionsByAsset } from "./position";
import type { Trade } from "./trade-schema";

let n = 0;
const trade = (t: Partial<Trade> & Pick<Trade, "date" | "side" | "quantity" | "total_usd">): Trade => ({
  id: `t${++n}`,
  asset: "SOL",
  fee_usd: 0,
  quote_currency: "USD",
  quote_amount: null,
  fx_usd_per_quote: null,
  note: null,
  created_at: `${t.date}T00:00:00.000Z`,
  ...t,
});

const build = (trades: Trade[], prices: Record<string, number>, today = "2026-01-10", threshold?: number) =>
  buildInsights({ trades, positions: positionsByAsset(trades, prices), today, threshold });

const byId = (list: Insight[], id: string) => list.find((i) => i.id === id);

test("an empty ledger produces nothing", () => {
  assert.deepEqual(buildInsights({ trades: [], positions: [], today: "2026-01-10" }), []);
});

test("concentration is the biggest holding's share of current value", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000, asset: "SOL" }),
    trade({ date: "2026-01-02", side: "buy", quantity: 1, total_usd: 500, asset: "BTC" }),
  ];
  // SOL 10 × $120 = 1200; BTC 1 × $400 = 400 → SOL is 75% of 1600.
  const i = byId(build(trades, { SOL: 120, BTC: 400 }), "concentration");
  assert.ok(i, "expected a concentration insight");
  assert.match(i.title, /^SOL is 75% of what you hold$/);
  assert.match(i.detail, /\$1,200\.00 of \$1,600\.00 across 2 coins/);
});

test("value-based insights are skipped when a held coin has no price", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000, asset: "SOL" }),
    trade({ date: "2026-01-02", side: "buy", quantity: 1, total_usd: 500, asset: "XYZ" }),
  ];
  const ids = build(trades, { SOL: 120 }).map((i) => i.id);
  assert.deepEqual(ids.filter((id) => id === "concentration" || id === "realized-split"), []);
});

test("a position worth 2x its remaining cost shows how much sells to get that cost back", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 })];
  const i = byId(build(trades, { SOL: 300 }), "doubled-SOL");
  assert.ok(i, "expected the 2x insight");
  assert.match(i.title, /SOL is worth 3× what you still have in it/);
  // $1,000 of cost left / $300 = 3.33333333 SOL sold returns it, 6.66666667 SOL stays.
  assert.match(i.detail, /10 SOL at \$300\.00 is \$3,000\.00, against \$1,000\.00 of cost\./);
  assert.match(i.detail, /Selling 3\.33333333 SOL at today's price returns that \$1,000\.00/);
  assert.match(i.detail, /leaving 6\.66666667 SOL held at no remaining cost/);
  assert.equal(i.highlight, true, "the 2x insight leads the panel");
});

test("the capital-preservation note explains the idea without telling anyone to sell", () => {
  assert.match(CAPITAL_PRESERVATION, /^Capital preservation: /);
  const text = CAPITAL_PRESERVATION.toLowerCase();
  for (const word of ["you should", "we recommend", "take profit now"]) {
    assert.ok(!text.includes(word), `the note must not say "${word}"`);
  }
});

test("below 2x there is no such insight, and a part-sold position uses cost still in it", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 })];
  assert.equal(byId(build(trades, { SOL: 199 }), "doubled-SOL"), undefined);
  assert.ok(byId(build(trades, { SOL: 200 }), "doubled-SOL"), "exactly 2x counts");

  // Sell half: $500 of cost remains against 5 SOL, so $100/SOL still needs 2x = $200.
  const part = [...trades, trade({ date: "2026-01-02", side: "sell", quantity: 5, total_usd: 900 })];
  assert.equal(byId(build(part, { SOL: 199 }), "doubled-SOL"), undefined);
  const i = byId(build(part, { SOL: 200 }), "doubled-SOL");
  assert.ok(i);
  assert.match(i.detail, /Selling 2\.5 SOL at today's price returns that \$500\.00/);
});

test("the user's own multiple decides when the callout fires", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 })];
  // At 3x the default (2x) would fire, but this user asked for 5x.
  assert.equal(byId(build(trades, { SOL: 300 }, "2026-01-10", 5), "doubled-SOL"), undefined);
  assert.ok(byId(build(trades, { SOL: 500 }, "2026-01-10", 5), "doubled-SOL"), "fires at the user's line");
  // A cautious user wants to know at 1.5x.
  assert.ok(byId(build(trades, { SOL: 160 }, "2026-01-10", 1.5), "doubled-SOL"));
  // Junk or out-of-range values fall back inside the allowed band instead of throwing.
  assert.ok(byId(build(trades, { SOL: 300 }, "2026-01-10", Number.NaN), "doubled-SOL"));
  assert.ok(byId(build(trades, { SOL: 300 }, "2026-01-10", 0), "doubled-SOL"), "clamped to the 1.1 floor");
});

test("realized and unrealized profit are split, with the paper share", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 }),
    trade({ date: "2026-01-02", side: "sell", quantity: 5, total_usd: 700 }), // realized +200
  ];
  // 5 left at cost 500, worth 5 × 160 = 800 → unrealized +300; paper share 300/500 = 60%.
  const i = byId(build(trades, { SOL: 160 }), "realized-split");
  assert.ok(i);
  assert.equal(i.tone, "gain");
  assert.match(i.title, /\+\$200\.00 banked, \+\$300\.00 on paper/);
  assert.match(i.detail, /60% of your profit so far is unrealized/);
  assert.match(i.detail, /Total \+\$500\.00/);
});

test("cost basis is compared with the live price, per held coin", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 })];
  const i = byId(build(trades, { SOL: 80 }), "cost-SOL");
  assert.ok(i);
  assert.equal(i.tone, "loss");
  assert.match(i.title, /SOL is 20% below your average cost/);
  assert.match(i.detail, /You hold 10 SOL at an average cost of \$100\.00; the price is \$80\.00\./);
});

test("fees are totalled and shown against capital deployed", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000, fee_usd: 5 }),
    trade({ date: "2026-01-02", side: "buy", quantity: 10, total_usd: 1000, fee_usd: 15 }),
  ];
  const i = byId(build(trades, { SOL: 100 }), "fees");
  assert.ok(i);
  assert.match(i.title, /\$20\.00 paid in fees/);
  assert.match(i.detail, /Across 2 trades, that's 1% of the \$2,000\.00 you've put in\./);
});

test("no fee insight when every trade was free", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 1, total_usd: 100 })];
  assert.equal(byId(build(trades, { SOL: 100 }), "fees"), undefined);
});

test("fully sold coins are listed with their realized P/L", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000 }),
    trade({ date: "2026-01-02", side: "sell", quantity: 10, total_usd: 1500 }),
  ];
  const i = byId(build(trades, { SOL: 100 }), "closed");
  assert.ok(i);
  assert.equal(i.tone, "gain");
  assert.match(i.title, /1 coin fully sold/);
  assert.match(i.detail, /SOL — \+\$500\.00 realized/);
});

test("a ledger untouched for a month says so, a fresh one doesn't", () => {
  const trades = [trade({ date: "2026-01-01", side: "buy", quantity: 1, total_usd: 100 })];
  const stale = byId(build(trades, { SOL: 100 }, "2026-02-10"), "stale-ledger");
  assert.ok(stale);
  assert.match(stale.title, /No trades logged for 40 days/);
  assert.equal(byId(build(trades, { SOL: 100 }, "2026-01-20"), "stale-ledger"), undefined);
});

test("no insight ever tells the user what to do", () => {
  const trades = [
    trade({ date: "2026-01-01", side: "buy", quantity: 10, total_usd: 1000, fee_usd: 3 }),
    trade({ date: "2026-01-02", side: "sell", quantity: 4, total_usd: 800 }),
    trade({ date: "2026-01-03", side: "buy", quantity: 1, total_usd: 500, asset: "BTC" }),
  ];
  const text = build(trades, { SOL: 200, BTC: 400 }, "2026-03-01")
    .flatMap((i) => [i.title, i.detail])
    .join(" ")
    .toLowerCase();
  for (const word of ["should", "recommend", "consider", "take profit", "cut your", "buy more", "hold on"]) {
    assert.ok(!text.includes(word), `insight text must not say "${word}"`);
  }
});
