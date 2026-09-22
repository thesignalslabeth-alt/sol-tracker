import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import { NoticeScreen } from "@/components/dashboard/notice-screen";
import { getViewer } from "@/lib/auth";
import { clerkConfigured } from "@/lib/auth-config";
import { OversellError, positionsByAsset } from "@/lib/position";
import { getPrices } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

export default async function Page({ searchParams }: PageProps<"/">) {
  await connection(); // always render per request: live prices + mutable trades

  const viewer = await getViewer();
  if (viewer.status === "signed-out") redirect("/sign-in");
  if (viewer.status === "misconfigured") {
    return <NoticeScreen title="Authentication isn't configured">Set the Clerk environment variables.</NoticeScreen>;
  }
  if (viewer.status === "forbidden") {
    return (
      <NoticeScreen title="Not authorized" showUserButton>
        This account isn&apos;t on the allowlist. To grant access, add this ID to{" "}
        <code className="font-mono">ALLOWED_USER_IDS</code>:
        <code className="mt-3 block rounded-md bg-muted p-2 font-mono text-sm break-all">{viewer.userId}</code>
      </NoticeScreen>
    );
  }

  const [{ asset: requested }, prices, trades] = await Promise.all([
    searchParams,
    getPrices(),
    getTradesRepo().then((r) => r.list(viewer.userId)),
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
      authBypassed={viewer.status === "bypassed"}
      showUserButton={clerkConfigured}
    />
  );
}
