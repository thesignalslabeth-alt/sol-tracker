"use client";

import { UserButton } from "@clerk/nextjs";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtUsd } from "@/lib/format";
import type { SolPrice } from "@/lib/price";

export function DashboardHeader({
  price,
  renderedAt,
  onAdd,
  showUserButton,
}: {
  price: SolPrice;
  renderedAt: string;
  onAdd: () => void;
  showUserButton: boolean;
}) {
  const updated = new Date(price.fetchedAt ?? renderedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight">SOL Tracker</h1>
          <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
            {price.usd != null ? `${fmtUsd(price.usd)} · updated ${updated}` : "Price unavailable"}
          </p>
        </div>
        {price.stale && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
            Price stale
          </Badge>
        )}
        <Button className="hidden md:inline-flex" onClick={onAdd}>
          <PlusIcon /> Add trade
        </Button>
        {showUserButton && <UserButton />}
      </div>
    </header>
  );
}
