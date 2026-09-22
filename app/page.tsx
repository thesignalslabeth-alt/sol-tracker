import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import { NoticeScreen } from "@/components/dashboard/notice-screen";
import { getViewer } from "@/lib/auth";
import { clerkConfigured } from "@/lib/auth-config";
import { calculatePosition, OversellError } from "@/lib/position";
import { getSolPrice } from "@/lib/price";
import { getTradesRepo } from "@/lib/trades-repo";

export default async function Page() {
  await connection(); // always render per request: live price + mutable trades

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

  const [price, trades] = await Promise.all([getSolPrice(), (await getTradesRepo()).list()]);

  let position;
  try {
    position = calculatePosition(trades, price.usd ?? 0);
  } catch (e) {
    if (e instanceof OversellError) {
      return <NoticeScreen title="Trade ledger is inconsistent">{e.message}. Fix the stored trades.</NoticeScreen>;
    }
    throw e;
  }

  return (
    <Dashboard
      trades={trades}
      position={position}
      price={price}
      renderedAt={new Date().toISOString()}
      authBypassed={viewer.status === "bypassed"}
      showUserButton={clerkConfigured}
    />
  );
}
