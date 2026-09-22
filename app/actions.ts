"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireOwner } from "@/lib/auth";
import { calculatePosition, OversellError } from "@/lib/position";
import { normalizeInput, tradeInputSchema, type Trade } from "@/lib/trade-schema";
import { getTradesRepo } from "@/lib/trades-repo";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await requireOwner();
    await fn();
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError || e instanceof OversellError || e instanceof InputError) {
      return { ok: false, error: e.message };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong saving the trade." };
  }
}

class InputError extends Error {}

function parse(input: unknown) {
  const r = tradeInputSchema.safeParse(input);
  if (!r.success) throw new InputError(r.error.issues.map((i) => i.message).join("; "));
  return normalizeInput(r.data);
}

/** Every mutation re-runs the whole ledger so no sell can end up oversold. */
function assertValidLedger(trades: Trade[]) {
  calculatePosition(trades, 0);
}

export async function createTrade(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const data = parse(input);
    const repo = await getTradesRepo();
    const trade: Trade = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    assertValidLedger([...(await repo.list()), trade]);
    await repo.create(trade);
  });
}

export async function updateTrade(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const data = parse(input);
    const repo = await getTradesRepo();
    const trades = await repo.list();
    const existing = trades.find((t) => t.id === id);
    if (!existing) throw new InputError("That trade no longer exists.");
    const trade: Trade = { ...existing, ...data };
    assertValidLedger(trades.map((t) => (t.id === id ? trade : t)));
    await repo.update(trade);
  });
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  return run(async () => {
    const repo = await getTradesRepo();
    const trades = await repo.list();
    try {
      assertValidLedger(trades.filter((t) => t.id !== id));
    } catch (e) {
      if (e instanceof OversellError) {
        throw new InputError(`Can't delete: the sell on ${e.date} would then exceed holdings.`);
      }
      throw e;
    }
    await repo.remove(id);
  });
}
