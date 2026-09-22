"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradeFormSheet } from "@/components/trade-form/trade-form-sheet";
import type { Position } from "@/lib/position";
import type { SolPrice } from "@/lib/price";
import type { Trade } from "@/lib/trade-schema";
import { DashboardHeader } from "./header";
import { MetricCards } from "./metric-cards";
import { PLWaterfallChart } from "./pl-waterfall-chart";
import { SolAllocationChart } from "./sol-allocation-chart";
import { TradeHistory } from "./trade-history";
import { useAutoRefresh } from "./use-auto-refresh";

export type DashboardProps = {
  trades: Trade[];
  position: Position;
  price: SolPrice;
  renderedAt: string;
  authBypassed: boolean;
  showUserButton: boolean;
};

export function Dashboard({ trades, position, price, renderedAt, authBypassed, showUserButton }: DashboardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  useAutoRefresh(60_000);

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
      <DashboardHeader price={price} renderedAt={renderedAt} onAdd={openAdd} showUserButton={showUserButton} />

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-6">
        <MetricCards position={position} price={price} />
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <SolAllocationChart position={position} />
          <PLWaterfallChart position={position} priceAvailable={price.usd != null} />
        </div>
        <TradeHistory trades={trades} position={position} onEdit={openEdit} />
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
        trades={trades}
        price={price}
      />
    </div>
  );
}
