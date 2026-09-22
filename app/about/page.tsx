import type { Metadata } from "next";
import { AboutPage } from "@/components/about/about-page";
import { getViewer } from "@/lib/auth";
import { allowedUserIds } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "About · Trade Tracker",
  description: "Track average cost, realized and unrealized P/L for any coin on Binance.",
};

export default async function About() {
  const viewer = await getViewer();
  // "forbidden" is signed in but not yet on the allowlist: "/" shows them their ID to send.
  const signedIn = viewer.status === "owner" || viewer.status === "bypassed" || viewer.status === "forbidden";
  return <AboutPage signedIn={signedIn} inviteOnly={allowedUserIds().length > 0} />;
}
