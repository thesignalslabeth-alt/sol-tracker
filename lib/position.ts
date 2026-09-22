// Pure position math. No I/O here — keep it that way so it stays trivially testable.
import type { Trade } from "./trade-schema";

export class OversellError extends Error {
  constructor(
    public readonly tradeId: string,
    public readonly date: string,
    public readonly shortfall: number,
  ) {
    super(`Sell on ${date} exceeds holdings at that date by ${Number(shortfall.toFixed(4))} SOL`);
    this.name = "OversellError";
  }
}

export type SaleResult = {
  id: string;
  date: string;
  solAmount: number;
  proceeds: number;
  avgCostAtSale: number;
  soldBasis: number;
  realizedPL: number;
  realizedPct: number;
};

export type Position = {
  avgCostBasis: number;
  solHeld: number;
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

/**
 * Moving average cost: buys re-average, sells remove basis at the current average
 * and leave the average unchanged. Throws OversellError if a sell exceeds holdings
 * at its own point in time.
 */
export function calculatePosition(trades: readonly Trade[], currentPrice: number): Position {
  let solHeld = 0;
  let costBasis = 0;
  let avgCost = 0;
  let totalCapitalDeployed = 0;
  let totalRealizedCash = 0;
  let realizedPL = 0;
  const sales: SaleResult[] = [];

  for (const t of sortTrades(trades)) {
    if (t.side === "buy") {
      costBasis += t.total_usd;
      solHeld += t.sol_amount;
      avgCost = costBasis / solHeld;
      totalCapitalDeployed += t.total_usd;
      continue;
    }

    if (t.sol_amount > solHeld + EPS) {
      throw new OversellError(t.id, t.date, t.sol_amount - solHeld);
    }
    const soldBasis = t.sol_amount * avgCost;
    const pl = t.total_usd - soldBasis;
    sales.push({
      id: t.id,
      date: t.date,
      solAmount: t.sol_amount,
      proceeds: t.total_usd,
      avgCostAtSale: avgCost,
      soldBasis,
      realizedPL: pl,
      realizedPct: soldBasis > 0 ? (pl / soldBasis) * 100 : 0,
    });
    realizedPL += pl;
    totalRealizedCash += t.total_usd;
    costBasis -= soldBasis;
    solHeld -= t.sol_amount;
    if (solHeld < EPS) {
      solHeld = 0;
      costBasis = 0;
    }
  }

  const unrealizedValue = solHeld * currentPrice;
  const unrealizedPL = unrealizedValue - costBasis;
  const totalPortfolioValue = totalRealizedCash + unrealizedValue;
  const totalPL = realizedPL + unrealizedPL;

  return {
    avgCostBasis: solHeld > 0 ? avgCost : 0,
    solHeld,
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
      solHeld > 0 ? Math.max(0, (totalCapitalDeployed - totalRealizedCash) / solHeld) : 0,
  };
}

export type TradePreview =
  | { ok: true; before: Position; after: Position; sale: SaleResult | null }
  | { ok: false; before: Position | null; error: string };

/**
 * Position before and after applying `draft` to the ledger. Pass `replaceId` when
 * editing so the old version of the trade is dropped first.
 */
export function previewTrade(
  trades: readonly Trade[],
  draft: Trade,
  currentPrice: number,
  replaceId?: string,
): TradePreview {
  const base = replaceId ? trades.filter((t) => t.id !== replaceId) : [...trades];
  let before: Position | null = null;
  try {
    before = calculatePosition(base, currentPrice);
    const after = calculatePosition([...base, draft], currentPrice);
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
export function maxSellable(trades: readonly Trade[], date: string, excludeId?: string): number {
  let held = 0;
  let min = Infinity;
  for (const t of sortTrades(trades)) {
    if (t.id === excludeId) continue;
    held += t.side === "buy" ? t.sol_amount : -t.sol_amount;
    if (t.date > date) min = Math.min(min, held);
    else min = held; // running holdings up to and including the draft's day
  }
  return Math.max(0, Math.min(min, held));
}
