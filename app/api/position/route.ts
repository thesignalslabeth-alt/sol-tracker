import { NextResponse } from "next/server";
import { AuthError, requireOwner } from "@/lib/auth";
import { calculatePosition } from "@/lib/position";
import { getSolPrice } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

export async function GET() {
  let userId: string;
  try {
    userId = await requireOwner();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [price, trades] = await Promise.all([getSolPrice(), (await getTradesRepo()).list(userId)]);
  return NextResponse.json({
    trades,
    position: calculatePosition(trades, price.usd ?? 0),
    price,
    lastUpdated: new Date().toISOString(),
  });
}
