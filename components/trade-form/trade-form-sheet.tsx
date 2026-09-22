"use client";

import { useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { SolPrice } from "@/lib/price";
import type { Trade } from "@/lib/trade-schema";
import { TradeForm } from "./trade-form";

const DESKTOP = "(min-width: 768px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false, // mobile first on the server
  );
}

/** Bottom sheet on mobile, centered dialog from md up. */
export function TradeFormSheet({
  open,
  onOpenChange,
  editing,
  trades,
  price,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Trade | null;
  trades: Trade[];
  price: SolPrice;
}) {
  const isDesktop = useIsDesktop();
  const title = editing ? "Edit trade" : "Add trade";
  const description = editing ? "Changes are re-checked against the whole ledger." : "Log a buy or sell.";
  // Remount per open/trade so the form resets cleanly.
  const form = open && (
    <TradeForm
      key={editing?.id ?? "new"}
      editing={editing}
      trades={trades}
      price={price}
      onDone={() => onOpenChange(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-safe">{form}</div>
      </DrawerContent>
    </Drawer>
  );
}
