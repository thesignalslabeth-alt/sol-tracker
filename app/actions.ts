"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  createTradeFor,
  deleteTradeFor,
  importTradesFor,
  saveSettingsFor,
  setInsightsFor,
  toActionError,
  updateTradeFor,
  type ImportRow,
} from "@/lib/ledger";

// Thin wrappers: the rules live in lib/ledger.ts, shared with the /api/v1 routes.

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ImportResult = { ok: true; inserted: number; skipped: number } | { ok: false; error: string };
export type { ImportRow };

async function run<T extends { ok: true }>(fn: (userId: string) => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    const userId = await requireOwner();
    const result = await fn(userId);
    revalidatePath("/");
    return result;
  } catch (e) {
    const { ok, error } = toActionError(e);
    return { ok, error };
  }
}

export async function createTrade(input: unknown): Promise<ActionResult> {
  return run(async (userId) => {
    await createTradeFor(userId, input);
    return { ok: true as const };
  });
}

export async function updateTrade(id: string, input: unknown): Promise<ActionResult> {
  return run(async (userId) => {
    await updateTradeFor(userId, id, input);
    return { ok: true as const };
  });
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  return run(async (userId) => {
    await deleteTradeFor(userId, id);
    return { ok: true as const };
  });
}

export async function importTrades(rows: ImportRow[]): Promise<ImportResult> {
  return run(async (userId) => ({ ok: true as const, ...(await importTradesFor(userId, rows)) }));
}

/** Saves the settings sheet: insights on/off and the user's own capital-preservation multiple. */
export async function saveSettings(input: { insights: boolean; capitalThreshold: number }): Promise<ActionResult> {
  return run(async (userId) => {
    await saveSettingsFor(userId, input);
    return { ok: true as const };
  });
}

/** Turns the insights panel on or off for the signed-in user. Off by default. */
export async function setInsightsEnabled(enabled: boolean): Promise<ActionResult> {
  return run(async (userId) => {
    await setInsightsFor(userId, enabled);
    return { ok: true as const };
  });
}
