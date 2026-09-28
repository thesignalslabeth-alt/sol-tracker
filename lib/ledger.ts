import "server-only";

import { createHash } from "node:crypto";
import { AuthError } from "./auth";
import { OversellError, validateLedger } from "./position";
import { clampThreshold, type Prefs } from "./prefs";
import { getPrefsRepo } from "./prefs-repo";
import { getPrices } from "./price";
import { normalizeInput, tradeInputSchema, type Trade } from "./trade-schema";
import { getTradesRepo } from "./trades-repo";

// Every ledger mutation, scoped to one user. Shared by the server actions (web app)
// and the /api/v1 route handlers (mobile app), so both enforce exactly the same rules.
// Callers resolve the user with requireOwner() first.

export class InputError extends Error {}

export type ImportRow = { fingerprint: string; input: unknown; createdAt?: string };

export const MAX_IMPORT_ROWS = 5000;

/** Errors a user can act on get their message; anything else is logged and hidden. */
export function toActionError(e: unknown): { ok: false; error: string; status: number } {
  if (e instanceof AuthError) return { ok: false, error: e.message, status: e.status };
  if (e instanceof OversellError || e instanceof InputError) return { ok: false, error: e.message, status: 400 };
  console.error(e);
  return { ok: false, error: "Something went wrong saving your trades.", status: 500 };
}

function parse(input: unknown) {
  const r = tradeInputSchema.safeParse(input);
  if (!r.success) throw new InputError(r.error.issues.map((i) => i.message).join("; "));
  return normalizeInput(r.data);
}

/** Rejects assets without a Binance USDT pair. Skipped if Binance is unreachable. */
async function assertListed(assets: Iterable<string>) {
  const { usd } = await getPrices();
  if (Object.keys(usd).length === 0) return;
  const missing = [...new Set(assets)].filter((a) => !(a in usd));
  if (missing.length) throw new InputError(`Not on Binance (no USDT pair): ${missing.join(", ")}`);
}

export async function createTradeFor(userId: string, input: unknown): Promise<Trade> {
  const data = parse(input);
  await assertListed([data.asset]);
  const repo = await getTradesRepo();
  const trade: Trade = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  // Every mutation re-runs the whole ledger so no sell can end up oversold.
  validateLedger([...(await repo.list(userId)), trade]);
  await repo.create(userId, trade);
  return trade;
}

export async function updateTradeFor(userId: string, id: string, input: unknown): Promise<Trade> {
  const data = parse(input);
  await assertListed([data.asset]);
  const repo = await getTradesRepo();
  const trades = await repo.list(userId);
  const existing = trades.find((t) => t.id === id);
  if (!existing) throw new InputError("That trade no longer exists.");
  const trade: Trade = { ...existing, ...data };
  validateLedger(trades.map((t) => (t.id === id ? trade : t)));
  await repo.update(userId, trade);
  return trade;
}

export async function deleteTradeFor(userId: string, id: string): Promise<void> {
  const repo = await getTradesRepo();
  const trades = await repo.list(userId);
  try {
    validateLedger(trades.filter((t) => t.id !== id));
  } catch (e) {
    if (e instanceof OversellError) {
      throw new InputError(`Can't delete: the ${e.asset} sell on ${e.date} would then exceed holdings.`);
    }
    throw e;
  }
  await repo.remove(userId, id);
}

/**
 * Imports parsed CSV rows. Ids are derived from the user + source row, so importing
 * the same file twice skips rows already present. All-or-nothing: if the combined
 * ledger would oversell, nothing is saved.
 */
export async function importTradesFor(userId: string, rows: ImportRow[]): Promise<{ inserted: number; skipped: number }> {
  if (!Array.isArray(rows) || rows.length === 0) throw new InputError("No rows to import.");
  if (rows.length > MAX_IMPORT_ROWS) throw new InputError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

  const now = Date.now();
  const incoming: Trade[] = rows.map((r, i) => {
    let data;
    try {
      data = parse(r?.input);
    } catch (e) {
      throw new InputError(`Row ${i + 1}: ${(e as Error).message}`);
    }
    const created = r.createdAt && !Number.isNaN(Date.parse(r.createdAt)) ? r.createdAt : new Date(now + i).toISOString();
    const id = "imp-" + createHash("sha256").update(`${userId}|${String(r.fingerprint)}`).digest("hex").slice(0, 32);
    return { ...data, id, created_at: created };
  });
  await assertListed(incoming.map((t) => t.asset));

  const repo = await getTradesRepo();
  const existing = await repo.list(userId);
  const seen = new Set(existing.map((t) => t.id));
  const fresh = incoming.filter((t) => !seen.has(t.id) && (seen.add(t.id), true));
  validateLedger([...existing, ...fresh]);
  const inserted = await repo.createMany(userId, fresh);
  return { inserted, skipped: rows.length - inserted };
}

/** Saves the settings sheet: insights on/off and the user's own capital-preservation multiple. */
export async function saveSettingsFor(userId: string, input: { insights?: unknown; capitalThreshold?: unknown }): Promise<Prefs> {
  const prefs = await getPrefsRepo();
  const next: Prefs = { insights: Boolean(input?.insights), capitalThreshold: clampThreshold(input?.capitalThreshold) };
  await prefs.set(userId, next);
  return next;
}

/** Turns the insights panel on or off. Off by default. */
export async function setInsightsFor(userId: string, enabled: boolean): Promise<void> {
  const prefs = await getPrefsRepo();
  await prefs.set(userId, { ...(await prefs.get(userId)), insights: Boolean(enabled) });
}
