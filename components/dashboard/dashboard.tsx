"use client";

import { useState } from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImportSheet } from "@/components/import/import-sheet";
import { TradeFormSheet } from "@/components/trade-form/trade-form-sheet";
import type { AssetPosition } from "@/lib/position";
import type { Prices } from "@/lib/price";
import type { Trade } from "@/lib/trade-schema";
import { AssetAllocationChart, PortfolioAllocationChart } from "./allocation-charts";
import { AssetSwitcher } from "./asset-switcher";
import { DashboardHeader } from "./header";
import { MetricCards } from "./metric-cards";
import { PLWaterfallChart } from "./pl-waterfall-chart";
import { PortfolioOverview } from "./portfolio-overview";
import { TradeHistory } from "./trade-history";
import { useAutoRefresh } from "./use-auto-refresh";

export type DashboardProps = {
  trades: Trade[];
  positions: AssetPosition[];
  /** An asset symbol, or "ALL" for the portfolio overview. */
  selected: string;
  prices: Prices;
  knownAssets: string[];
  renderedAt: string;
  authBypassed: boolean;
  showUserButton: boolean;
};

export function Dashboard({
  trades,
  positions,
  selected,
  prices,
  knownAssets,
  renderedAt,
  authBypassed,
  showUserButton,
}: DashboardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  useAutoRefresh(60_000);

  const current = positions.find((p) => p.asset === selected) ?? null;
  const visibleTrades = current ? trades.filter((t) => t.asset === current.asset) : trades;
  const defaultAsset = current?.asset ?? positions[0]?.asset ?? "SOL";

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: Trade) => {
    setEditing(t);
    setFormOpen(true);
  };

  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      {authBypassed && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          Auth is off: Clerk keys not set (local dev only).
        </div>
      )}
      <DashboardHeader
        current={current}
        assetCount={positions.length}
        prices={prices}
        renderedAt={renderedAt}
        onAdd={openAdd}
        onImport={() => setImportOpen(true)}
        canExport={trades.length > 0}
        showUserButton={showUserButton}
      />
      {positions.length > 1 && <AssetSwitcher assets={positions.map((p) => p.asset)} selected={selected} />}

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-6">
        {positions.length === 0 ? (
          <EmptyState onAdd={openAdd} onImport={() => setImportOpen(true)} />
        ) : current ? (
          <>
            <MetricCards asset={current.asset} position={current.position} price={current.price} />
            <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              <AssetAllocationChart asset={current.asset} position={current.position} />
              <PLWaterfallChart position={current.position} priceAvailable={current.price != null} />
            </div>
          </>
        ) : (
          <>
            <PortfolioOverview positions={positions} />
            <PortfolioAllocationChart positions={positions} />
          </>
        )}
        {trades.length > 0 && (
          <TradeHistory trades={visibleTrades} positions={positions} showAsset={!current} onEdit={openEdit} />
        )}
      </main>

      {/* Mobile: sticky add button, clear of the home indicator */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 px-4 pt-3 pb-safe backdrop-blur md:hidden">
        <Button className="h-12 w-full text-base" onClick={openAdd}>
          <PlusIcon /> Add trade
        </Button>
      </div>

      <TradeFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultAsset={defaultAsset}
        trades={trades}
        prices={prices}
        knownAssets={knownAssets}
      />
      <ImportSheet open={importOpen} onOpenChange={setImportOpen} knownAssets={knownAssets} />
    </div>
  );
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div>
          <p className="text-lg font-semibold">No trades yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Log a buy or sell for any coin listed on Binance, or import a CSV from Binance or the template.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="h-11" onClick={onAdd}>
            <PlusIcon /> Add trade
          </Button>
          <Button variant="outline" className="h-11" onClick={onImport}>
            <UploadIcon /> Import CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
