import { ownerJson, readJson } from "@/lib/api-route";
import { createTradeFor } from "@/lib/ledger";

export async function POST(req: Request) {
  return ownerJson(async (userId) => ({ ok: true, trade: await createTradeFor(userId, await readJson(req)) }));
}
