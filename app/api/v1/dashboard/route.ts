import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { ownerJson } from "@/lib/api-route";
import { todaySg } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { InputError } from "@/lib/ledger";
import { OversellError, positionsByAsset } from "@/lib/position";
import { getPrefsRepo } from "@/lib/prefs-repo";
import { getPrices } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

/** Everything the dashboard shows (the same data app/page.tsx loads), for the mobile app. */
export async function GET() {
  // Not on the allowlist: say so with the user's ID, like the web "You're almost in" screen.
  const viewer = await getViewer();
  if (viewer.status === "forbidden") {
    return NextResponse.json({ ok: false, error: "Not authorized", userId: viewer.userId }, { status: 403 });
  }

  return ownerJson(async (userId) => {
    const [prices, trades, prefs] = await Promise.all([
      getPrices(),
      getTradesRepo().then((r) => r.list(userId)),
      getPrefsRepo().then((r) => r.get(userId)),
    ]);
    let positions;
    try {
      positions = positionsByAsset(trades, prices.usd);
    } catch (e) {
      if (e instanceof OversellError) throw new InputError(`Trade ledger is inconsistent: ${e.message}`);
      throw e;
    }
    return {
      trades,
      positions,
      prices,
      prefs,
      insights: prefs.insights ? buildInsights({ trades, positions, today: todaySg(), threshold: prefs.capitalThreshold }) : null,
      renderedAt: new Date().toISOString(),
    };
  });
}
