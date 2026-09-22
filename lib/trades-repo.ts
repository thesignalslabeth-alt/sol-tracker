import "server-only";
import type { Trade } from "./trade-schema";

/** Storage boundary. The UI and position math never touch storage directly. */
export interface TradesRepo {
  list(): Promise<Trade[]>;
  create(trade: Trade): Promise<void>;
  update(trade: Trade): Promise<void>;
  remove(id: string): Promise<void>;
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
