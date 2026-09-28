import { ownerJson, readJson } from "@/lib/api-route";
import { deleteTradeFor, updateTradeFor } from "@/lib/ledger";

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/trades/[id]">) {
  const { id } = await ctx.params;
  return ownerJson(async (userId) => ({ ok: true, trade: await updateTradeFor(userId, id, await readJson(req)) }));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/v1/trades/[id]">) {
  const { id } = await ctx.params;
  return ownerJson(async (userId) => {
    await deleteTradeFor(userId, id);
    return { ok: true };
  });
}
