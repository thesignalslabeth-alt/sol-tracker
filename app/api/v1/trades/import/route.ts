import { ownerJson, readJson } from "@/lib/api-route";
import { importTradesFor, type ImportRow } from "@/lib/ledger";

/** Body: { rows: ImportRow[] }, the same rows the web import sheet sends. */
export async function POST(req: Request) {
  return ownerJson(async (userId) => {
    const body = (await readJson(req)) as { rows?: ImportRow[] } | null;
    return { ok: true, ...(await importTradesFor(userId, body?.rows ?? [])) };
  });
}
