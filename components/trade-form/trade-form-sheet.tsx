"use client";

import { ResponsiveSheet } from "@/components/responsive-sheet";
import type { Prices } from "@/lib/price";
import type { Trade } from "@/lib/trade-schema";
import { TradeForm } from "./trade-form";

export function TradeFormSheet({
  open,
  onOpenChange,
  editing,
  defaultAsset,
  trades,
  prices,
  knownAssets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Trade | null;
  defaultAsset: string;
  trades: Trade[];
  prices: Prices;
  knownAssets: string[];
}) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit trade" : "Add trade"}
      description={
        editing ? "Changes are re-checked against the whole ledger." : "Log a buy, sell or staking reward for any coin listed on Binance."
      }
    >
      {/* Remount per open/trade so the form resets cleanly. */}
      {open && (
        <TradeForm
          key={editing?.id ?? "new"}
          editing={editing}
          defaultAsset={defaultAsset}
          trades={trades}
          prices={prices}
          knownAssets={knownAssets}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveSheet>
  );
}
