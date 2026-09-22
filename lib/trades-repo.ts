import "server-only";
import type { Trade } from "./trade-schema";

/**
 * Storage boundary. The UI and position math never touch storage directly.
 * Every method is scoped to one user: a user can only see or change their own trades.
 */
export interface TradesRepo {
  list(userId: string): Promise<Trade[]>;
  create(userId: string, trade: Trade): Promise<void>;
  update(userId: string, trade: Trade): Promise<void>;
  remove(userId: string, id: string): Promise<void>;
}

let repo: TradesRepo | null = null;

export async function getTradesRepo(): Promise<TradesRepo> {
  if (repo) return repo;
  const store = process.env.TRADES_STORE ?? "json";
  if (store === "postgres") {
    const { PostgresTradesRepo } = await import("./repo/postgres");
    repo = new PostgresTradesRepo();
  } else if (store === "json") {
    if (process.env.VERCEL) {
      throw new Error("TRADES_STORE=json can't persist on Vercel (read-only filesystem). Use postgres.");
    }
    const { JsonTradesRepo } = await import("./repo/json");
    repo = new JsonTradesRepo();
  } else {
    throw new Error(`Unknown TRADES_STORE "${store}" (expected "json" or "postgres")`);
  }
  return repo;
}
