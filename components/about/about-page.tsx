import Link from "next/link";
import {
  ArrowRightIcon,
  CoinsIcon,
  FileSpreadsheetIcon,
  LockIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: ScaleIcon,
    title: "True average cost",
    body: "Moving-average cost basis per coin: buys re-average it, sells don't. See the break-even price for the whole trade.",
  },
  {
    icon: TrendingUpIcon,
    title: "Realized vs unrealized",
    body: "Profit you've locked in by selling, kept separate from paper gains on what you still hold, at live prices.",
  },
  {
    icon: CoinsIcon,
    title: "Any coin on Binance",
    body: "BTC, ETH, SOL and hundreds more. Every coin with a USDT pair on Binance is priced live.",
  },
  {
    icon: FileSpreadsheetIcon,
    title: "Import from Binance",
    body: "Upload your Binance trade history CSV, preview every row, then save. Export anytime.",
  },
  {
    icon: SmartphoneIcon,
    title: "Built for your phone",
    body: "Log a trade in seconds. Add it to your home screen and it opens like an app.",
  },
  {
    icon: LockIcon,
    title: "Your ledger is yours",
    body: "Each account has its own private ledger. Nobody else can see or change your trades.",
  },
];

const STEPS = [
  { title: "Sign in", body: "With Google or email." },
  { title: "Add your trades", body: "Type them in, or import a Binance CSV." },
  { title: "Track", body: "Cost basis, P/L and allocation update with live prices." },
];

// Illustrative figures only. This page is public, so never show real account data here.
const EXAMPLE = [
  { label: "Avg cost basis", value: "$64.20" },
  { label: "Current price", value: "$118.40", tone: "gain", sub: "+84.4% vs avg cost" },
  { label: "Realized P/L", value: "+$1,204.50", tone: "gain" },
  { label: "Break-even price", value: "$22.15" },
] as const;

export function AboutPage({ signedIn, inviteOnly }: { signedIn: boolean; inviteOnly: boolean }) {
  const cta = signedIn ? (
    <Button asChild className="h-12 px-6 text-base">
      <Link href="/">
        Open your dashboard <ArrowRightIcon />
      </Link>
    </Button>
  ) : (
    <Button asChild className="h-12 px-6 text-base">
      <Link href="/sign-in">
        Sign in to get started <ArrowRightIcon />
      </Link>
    </Button>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-6">
          <span className="font-semibold">Trade Tracker</span>
          <Button asChild variant={signedIn ? "outline" : "default"} className="h-10">
            <Link href={signedIn ? "/" : "/sign-in"}>{signedIn ? "Dashboard" : "Sign in"}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 md:px-6">
        {/* Hero */}
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance md:text-5xl">
              Know what your crypto trades actually made.
            </h1>
            <p className="text-base text-muted-foreground text-pretty md:text-lg">
              Log your buys and sells and see your average cost, realized and unrealized profit, and break-even price
              for every coin, with live prices from Binance.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {cta}
              {inviteOnly && !signedIn && (
                <span className="text-sm text-muted-foreground">Invite only for now. Ask the owner for access.</span>
              )}
            </div>
          </div>

          {/* Example dashboard, clearly labelled */}
          <div className="relative">
            <span className="absolute -top-3 left-4 z-10 rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
              Example
            </span>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/40 p-3 md:p-4">
              {EXAMPLE.map((m) => (
                <Card key={m.label} className="gap-0 py-3">
                  <CardContent className="px-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${"tone" in m ? "text-gain" : ""}`}>{m.value}</p>
                    {"sub" in m && <p className="text-xs text-muted-foreground">{m.sub}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="space-y-6 py-8">
          <h2 id="features" className="text-xl font-semibold md:text-2xl">
            What it does
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="gap-0 py-4">
                <CardContent className="space-y-2 px-4">
                  <f.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="space-y-6 py-8">
          <h2 id="how" className="text-xl font-semibold md:text-2xl">
            How it works
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl border p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Safety */}
        <section aria-labelledby="safety" className="py-8">
          <div className="flex gap-4 rounded-xl border bg-muted/40 p-5">
            <ShieldCheckIcon className="size-6 shrink-0 text-gain" aria-hidden />
            <div className="space-y-2">
              <h2 id="safety" className="font-semibold">
                No wallets, no keys
              </h2>
              <p className="text-sm text-muted-foreground">
                Trade Tracker never connects to your wallet or exchange account, and never asks for seed phrases, private
                keys or API keys. You enter trades yourself or upload a CSV. Prices come from Binance&apos;s public market
                data.
              </p>
              <p className="text-xs text-muted-foreground">
                For record-keeping only. Not financial or tax advice.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-lg font-medium">Ready to see your real numbers?</p>
          {cta}
        </section>
      </main>
    </div>
  );
}
