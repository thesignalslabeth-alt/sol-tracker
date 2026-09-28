import { ownerJson, readJson } from "@/lib/api-route";
import { saveSettingsFor } from "@/lib/ledger";

/** Body: { insights: boolean, capitalThreshold: number }. Returns the saved (clamped) prefs. */
export async function PUT(req: Request) {
  return ownerJson(async (userId) => {
    const body = (await readJson(req)) as { insights?: unknown; capitalThreshold?: unknown } | null;
    return { ok: true, prefs: await saveSettingsFor(userId, body ?? {}) };
  });
}
