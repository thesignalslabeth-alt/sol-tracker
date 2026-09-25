// Pure position math. No I/O here — keep it that way so it stays trivially testable.
import type { Trade } from "./trade-schema";

export class OversellError extends Error {
  constructor(
    public readonly tradeId: string,
    public readonly asset: string,
    public readonly date: string,
    public readonly shortfall: number,
  ) {
    super(`${asset} sell on ${date} exceeds holdings at that date by ${Number(shortfall.toFixed(8))} ${asset}`);
    this.name = "OversellError";
  }
}

export type SaleResult = {
  id: string;
  date: string;
  quantity: number;
  proceeds: number;
  avgCostAtSale: number;
  soldBasis: number;
  realizedPL: number;
  realizedPct: number;
};

export type Position = {
  avgCostBasis: number;
  held: number;
  /** Quantity received as staking rewards, included in `held`. */
  stakedQuantity: number;
  remainingCostBasis: number;
  totalCapitalDeployed: number;
  totalRealizedCash: number;
  realizedPL: number;
  sales: SaleResult[];
  unrealizedValue: number;
  unrealizedPL: number;
  totalPortfolioValue: number;
  totalPL: number;
  totalProfitPct: number;
  breakEvenPrice: number;
};

// Guards against float dust (e.g. selling "all" 40 SOL leaving 1e-14).
const EPS = 1e-9;

export function sortTrades<T extends Pick<Trade, "date" | "created_at">>(trades: readonly T[]): T[] {
  return [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at),
  );
}

/** Trades grouped by asset symbol, assets sorted alphabetically. */
export function groupByAsset(trades: readonly Trade[]): Map<string, Trade[]> {
  const groups = new Map<string, Trade[]>();
  for (const t of [...trades].sort((a, b) => a.asset.localeCompare(b.asset))) {
    const g = groups.get(t.asset);
    if (g) g.push(t);
    else groups.set(t.asset, [t]);
  }
  return groups;
}

/** Throws OversellError if any asset's ledger has a sell exceeding holdings. */
export function validateLedger(trades: readonly Trade[]): void {
  for (const group of groupByAsset(trades).values()) calculatePosition(group, 0);
}

export type AssetPosition = { asset: string; price: number | null; position: Position };

/** One position per asset; assets without a price are valued at 0 and flagged with price: null. */
export function positionsByAsset(trades: readonly Trade[], prices: Readonly<Record<string, number>>): AssetPosition[] {
  return [...groupByAsset(trades)].map(([asset, group]) => {
    const price = prices[asset] ?? null;
    return { asset, price, position: calculatePosition(group, price ?? 0) };
  });
}

/**
 * Moving average cost for a single asset's trades: buys re-average, sells remove basis at the current average
 * and leave the average unchanged. Staking rewards are buys that cost nothing: they add
 * quantity, deploy no capital, and so pull the average cost and break-even down.
 * Throws OversellError if a sell exceeds holdings at its own point in time.
 */
export function calculatePosition(trades: readonly Trade[], currentPrice: number): Position {
  let held = 0;
  let costBasis = 0;
  let avgCost = 0;
  let stakedQuantity = 0;
  let totalCapitalDeployed = 0;
  let totalRealizedCash = 0;
  let realizedPL = 0;
  const sales: SaleResult[] = [];

  for (const t of sortTrades(trades)) {
    // Staking rewards land here too, with total_usd of 0.
    if (t.side !== "sell") {
      costBasis += t.total_usd;
      held += t.quantity;
      avgCost = costBasis / held;
      totalCapitalDeployed += t.total_usd;
      if (t.side === "stake") stakedQuantity += t.quantity;
      continue;
    }

    if (t.quantity > held + EPS) {
      throw new OversellError(t.id, t.asset, t.date, t.quantity - held);
    }
    const soldBasis = t.quantity * avgCost;
    const pl = t.total_usd - soldBasis;
    sales.push({
      id: t.id,
      date: t.date,
      quantity: t.quantity,
      proceeds: t.total_usd,
      avgCostAtSale: avgCost,
      soldBasis,
      realizedPL: pl,
      realizedPct: soldBasis > 0 ? (pl / soldBasis) * 100 : 0,
    });
    realizedPL += pl;
    totalRealizedCash += t.total_usd;
    costBasis -= soldBasis;
    held -= t.quantity;
    if (held < EPS) {
      held = 0;
      costBasis = 0;
    }
  }

  const unrealizedValue = held * currentPrice;
  const unrealizedPL = unrealizedValue - costBasis;
  const totalPortfolioValue = totalRealizedCash + unrealizedValue;
  const totalPL = realizedPL + unrealizedPL;

  return {
    avgCostBasis: held > 0 ? avgCost : 0,
    held,
    stakedQuantity,
    remainingCostBasis: costBasis,
    totalCapitalDeployed,
    totalRealizedCash,
    realizedPL,
    sales,
    unrealizedValue,
    unrealizedPL,
    totalPortfolioValue,
    totalPL,
    totalProfitPct: totalCapitalDeployed > 0 ? (totalPL / totalCapitalDeployed) * 100 : 0,
    breakEvenPrice:
      held > 0 ? Math.max(0, (totalCapitalDeployed - totalRealizedCash) / held) : 0,
  };
}

export type TradePreview =
  | { ok: true; before: Position; after: Position; sale: SaleResult | null }
  | { ok: false; before: Position | null; error: string };

/**
 * Position before and after applying `draft` to the ledger. Pass `replaceId` when
 * editing so the draft takes the old version's place.
 *
 * "Before" is the ledger as saved, old version included. Computing it with the edited
 * trade removed would make any buy that later sells depend on look like an oversell.
 */
export function previewTrade(
  trades: readonly Trade[],
  draft: Trade,
  currentPrice: number,
  replaceId?: string,
): TradePreview {
  const current = trades.filter((t) => t.asset === draft.asset);
  const next = [...current.filter((t) => t.id !== replaceId), draft];
  let before: Position | null = null;
  try {
    before = calculatePosition(current, currentPrice);
    const after = calculatePosition(next, currentPrice);
    const sale = after.sales.find((s) => s.id === draft.id) ?? null;
    return { ok: true, before, after, sale };
  } catch (e) {
    if (e instanceof OversellError) return { ok: false, before, error: e.message };
    throw e;
  }
}

/**
 * Largest sell that can be added on `date` without making it or any later sell
 * oversold. A new trade sorts after existing trades on the same day. Used for the
 * sell form's "Max" button.
 */
export function maxSellable(trades: readonly Trade[], asset: string, date: string, excludeId?: string): number {
  let held = 0;
  let min = Infinity;
  for (const t of sortTrades(trades)) {
    if (t.id === excludeId || t.asset !== asset) continue;
    held += t.side === "sell" ? -t.quantity : t.quantity;
    if (t.date > date) min = Math.min(min, held);
    else min = held; // running holdings up to and including the draft's day
  }
  return Math.max(0, Math.min(min, held));
}
