import { NextResponse } from "next/server";
import { AuthError, requireOwner } from "@/lib/auth";
import { positionsByAsset } from "@/lib/position";
import { getPrices } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

export async function GET() {
  let userId: string;
  try {
    userId = await requireOwner();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [prices, trades] = await Promise.all([getPrices(), (await getTradesRepo()).list(userId)]);
  return NextResponse.json({
    trades,
    positions: positionsByAsset(trades, prices.usd),
    prices: { stale: prices.stale, fetchedAt: prices.fetchedAt, usdPerSgd: prices.usdPerSgd },
    lastUpdated: new Date().toISOString(),
  });
}
