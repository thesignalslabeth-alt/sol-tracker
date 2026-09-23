import "server-only";
import type { Prefs } from "./prefs";

export interface PrefsRepo {
  get(userId: string): Promise<Prefs>;
  set(userId: string, prefs: Prefs): Promise<void>;
}

let repo: PrefsRepo | null = null;

/** Same store as the trades repo, chosen by TRADES_STORE. */
export async function getPrefsRepo(): Promise<PrefsRepo> {
  if (repo) return repo;
  const store = process.env.TRADES_STORE ?? "json";
  if (store === "postgres") {
    const { PostgresPrefsRepo } = await import("./repo/postgres");
    repo = new PostgresPrefsRepo();
  } else if (store === "json") {
    if (process.env.VERCEL) {
      throw new Error("TRADES_STORE=json can't persist on Vercel (read-only filesystem). Use postgres.");
    }
    const { JsonPrefsRepo } = await import("./repo/json");
    repo = new JsonPrefsRepo();
  } else {
    throw new Error(`Unknown TRADES_STORE "${store}" (expected "json" or "postgres")`);
  }
  return repo;
}
