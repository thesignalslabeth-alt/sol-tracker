"use client";

import { useTransition } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { DownloadIcon, InfoIcon, LightbulbIcon, PlusIcon, UploadIcon } from "lucide-react";
import { setInsightsEnabled } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtPrice } from "@/lib/format";
import type { AssetPosition } from "@/lib/position";
import type { Prices } from "@/lib/price";

export function DashboardHeader({
  current,
  assetCount,
  prices,
  renderedAt,
  onAdd,
  onImport,
  canExport,
  showUserButton,
  insightsOn,
}: {
  current: AssetPosition | null;
  assetCount: number;
  prices: Prices;
  renderedAt: string;
  onAdd: () => void;
  onImport: () => void;
  canExport: boolean;
  showUserButton: boolean;
  insightsOn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // In a transition so the dashboard re-renders with the new setting straight away.
  const toggleInsights = () => startTransition(() => void setInsightsEnabled(!insightsOn));
  const updated = new Date(prices.fetchedAt ?? renderedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const subtitle = current
    ? current.price != null
      ? `${current.asset} ${fmtPrice(current.price)} · updated ${updated}`
      : `${current.asset} · price unavailable`
    : assetCount > 0
      ? `${assetCount} ${assetCount === 1 ? "asset" : "assets"} · updated ${updated}`
      : "Prices from Binance";

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4 md:gap-2 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight">Trade Tracker</h1>
          <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
            {subtitle}
          </p>
        </div>
        {prices.stale && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
            Stale
          </Badge>
        )}
        <Button variant="ghost" size="icon-lg" className="size-10" asChild>
          <Link href="/about" aria-label="About Trade Tracker" title="About">
            <InfoIcon />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-lg" className="size-10" onClick={onImport} aria-label="Import CSV" title="Import CSV">
          <UploadIcon />
        </Button>
        {canExport && (
          <Button variant="ghost" size="icon-lg" className="size-10" asChild>
            <a href="/api/export" download aria-label="Export CSV" title="Export CSV">
              <DownloadIcon />
            </a>
          </Button>
        )}
        <Button className="ml-1 hidden md:inline-flex" onClick={onAdd}>
          <PlusIcon /> Add trade
        </Button>
        {!showUserButton && (
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-10"
            onClick={toggleInsights}
            disabled={pending}
            aria-pressed={insightsOn}
            aria-label={insightsOn ? "Hide insights" : "Show insights"}
            title={insightsOn ? "Hide insights" : "Show insights"}
          >
            <LightbulbIcon />
          </Button>
        )}
        {showUserButton && (
          <div className="ml-1 flex size-10 items-center justify-center">
            {/* The About page is also reachable from the account menu. */}
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link label="About Trade Tracker" labelIcon={<InfoIcon className="size-4" />} href="/about" />
                {/* Insights are opt-in: nothing about them shows on the dashboard until this is on. */}
                <UserButton.Action
                  label={insightsOn ? "Hide insights" : "Show insights"}
                  labelIcon={<LightbulbIcon className="size-4" />}
                  onClick={toggleInsights}
                />
              </UserButton.MenuItems>
            </UserButton>
          </div>
        )}
      </div>
    </header>
  );
}
