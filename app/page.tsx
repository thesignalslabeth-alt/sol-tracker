import { connection } from "next/server";
import { AboutPage } from "@/components/about/about-page";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AccessRequest } from "@/components/dashboard/access-request";
import { NoticeScreen } from "@/components/dashboard/notice-screen";
import { getViewer } from "@/lib/auth";
import { todaySg } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { getPrefsRepo } from "@/lib/prefs-repo";
import { allowedUserIds, clerkConfigured } from "@/lib/auth-config";
import { OversellError, positionsByAsset } from "@/lib/position";
import { getPrices } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

export default async function Page({ searchParams }: PageProps<"/">) {
  await connection(); // always render per request: live prices + mutable trades

  const viewer = await getViewer();
  // Signed-out visitors get the public About page instead of a bare sign-in form.
  if (viewer.status === "signed-out") return <AboutPage signedIn={false} inviteOnly={allowedUserIds().length > 0} />;
  if (viewer.status === "misconfigured") {
    return <NoticeScreen title="Authentication isn't configured">Set the Clerk environment variables.</NoticeScreen>;
  }
  if (viewer.status === "forbidden") {
    return (
      <NoticeScreen title="You're almost in" showUserButton>
        <p className="mb-4">
          Trade Tracker is invite-only. Copy your user ID below and send it to the person who invited you, so they can
          add you.
        </p>
        <AccessRequest userId={viewer.userId} />
      </NoticeScreen>
    );
  }

  const [{ asset: requested }, prices, trades, prefs] = await Promise.all([
    searchParams,
    getPrices(),
    getTradesRepo().then((r) => r.list(viewer.userId)),
    getPrefsRepo().then((r) => r.get(viewer.userId)),
  ]);

  let positions;
  try {
    positions = positionsByAsset(trades, prices.usd);
  } catch (e) {
    if (e instanceof OversellError) {
      return <NoticeScreen title="Trade ledger is inconsistent">{e.message}. Fix the stored trades.</NoticeScreen>;
    }
    throw e;
  }

  const assets = positions.map((p) => p.asset);
  const want = typeof requested === "string" ? requested.toUpperCase() : null;
  // One asset: go straight to it. Several: overview unless one is picked.
  const selected = want && assets.includes(want) ? want : assets.length === 1 ? assets[0] : "ALL";

  return (
    <Dashboard
      trades={trades}
      positions={positions}
      selected={selected}
      prices={prices}
      knownAssets={Object.keys(prices.usd).sort()}
      renderedAt={new Date().toISOString()}
      prefs={prefs}
      insights={prefs.insights ? buildInsights({ trades, positions, today: todaySg(), threshold: prefs.capitalThreshold }) : null}
      authBypassed={viewer.status === "bypassed"}
      showUserButton={clerkConfigured}
    />
  );
}
