import { NextResponse } from "next/server";
import { AuthError, requireOwner } from "@/lib/auth";
import { toTemplateCsv } from "@/lib/csv";
import { sortTrades } from "@/lib/position";
import { getTradesRepo } from "@/lib/trades-repo";

/** The signed-in user's trades as a re-importable CSV. */
export async function GET() {
  let userId: string;
  try {
    userId = await requireOwner();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const trades = sortTrades(await (await getTradesRepo()).list(userId));
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  return new NextResponse(toTemplateCsv(trades), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trades-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
