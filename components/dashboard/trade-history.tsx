"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteTrade } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDate, fmtPrice, fmtQty, fmtQtyNum, fmtSgd, fmtSignedPct, fmtSignedUsd, fmtUsd, plClass } from "@/lib/format";
import { sortTrades, type AssetPosition, type SaleResult } from "@/lib/position";
import type { Trade } from "@/lib/trade-schema";

function SideBadge({ side }: { side: Trade["side"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "uppercase",
        side === "buy" ? "border-gain/40 bg-gain/10 text-gain" : "border-loss/40 bg-loss/10 text-loss",
      )}
    >
      {side}
    </Badge>
  );
}

function RealizedCell({ sale }: { sale?: SaleResult }) {
  if (!sale) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", plClass(sale.realizedPL))}>
      {fmtSignedUsd(sale.realizedPL)} <span className="text-xs">({fmtSignedPct(sale.realizedPct)})</span>
    </span>
  );
}

export function TradeHistory({
  trades,
  positions,
  showAsset,
  onEdit,
}: {
  trades: Trade[];
  positions: AssetPosition[];
  showAsset: boolean;
  onEdit: (t: Trade) => void;
}) {
  const [newestFirst, setNewestFirst] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Trade | null>(null);
  const [deleting, startDelete] = useTransition();

  const sorted = useMemo(() => {
    const asc = sortTrades(trades);
    return newestFirst ? asc.reverse() : asc;
  }, [trades, newestFirst]);
  const saleById = useMemo(
    () => new Map(positions.flatMap((p) => p.position.sales).map((s) => [s.id, s])),
    [positions],
  );

  const confirmDelete = () => {
    const t = pendingDelete;
    if (!t) return;
    startDelete(async () => {
      const res = await deleteTrade(t.id);
      if (res.ok) toast.success("Trade deleted");
      else toast.error(res.error);
      setPendingDelete(null);
    });
  };

  const SortIcon = newestFirst ? ArrowDownIcon : ArrowUpIcon;
  const actions = (t: Trade) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-lg" className="size-11 md:size-9" onClick={() => onEdit(t)} aria-label="Edit trade">
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-11 text-loss hover:text-loss md:size-9"
        onClick={() => setPendingDelete(t)}
        aria-label="Delete trade"
      >
        <Trash2Icon />
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Trade history</CardTitle>
        <Button variant="outline" className="h-10 md:hidden" onClick={() => setNewestFirst((v) => !v)}>
          <SortIcon /> {newestFirst ? "Newest" : "Oldest"}
        </Button>
      </CardHeader>
      <CardContent className="px-3 md:px-6">
        {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No trades yet.</p>}

        {/* Mobile: card list */}
        <ul className="space-y-2 md:hidden">
          {sorted.map((t) => (
            <li key={t.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <SideBadge side={t.side} />
                    {showAsset && <span className="text-sm font-semibold">{t.asset}</span>}
                    <span className="text-sm text-muted-foreground">{fmtDate(t.date)}</span>
                  </div>
                  <p className="font-medium tabular-nums">
                    {fmtQty(t.quantity, t.asset)} <span className="text-muted-foreground">@ {fmtPrice(t.total_usd / t.quantity)}</span>
                  </p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {fmtUsd(t.total_usd)}
                    {t.quote_currency === "SGD" && t.quote_amount != null && ` · ${fmtSgd(t.quote_amount)}`}
                  </p>
                  {t.side === "sell" && (
                    <p className="text-sm">
                      <RealizedCell sale={saleById.get(t.id)} />
                    </p>
                  )}
                  {t.note && <p className="truncate text-xs text-muted-foreground">{t.note}</p>}
                </div>
                {actions(t)}
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setNewestFirst((v) => !v)}
                    aria-label={`Sort by date, currently ${newestFirst ? "newest" : "oldest"} first`}
                  >
                    Date <SortIcon className="size-3.5" />
                  </button>
                </TableHead>
                {showAsset && <TableHead>Asset</TableHead>}
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total (USD)</TableHead>
                <TableHead className="text-right">Realized P/L</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                  {showAsset && <TableCell className="font-semibold">{t.asset}</TableCell>}
                  <TableCell>
                    <SideBadge side={t.side} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtQtyNum(t.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPrice(t.total_usd / t.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtUsd(t.total_usd)}
                    {t.quote_currency === "SGD" && t.quote_amount != null && (
                      <div className="text-xs text-muted-foreground">{fmtSgd(t.quote_amount)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <RealizedCell sale={saleById.get(t.id)} />
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{t.note}</TableCell>
                  <TableCell>{actions(t)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
                `${pendingDelete.side === "buy" ? "Buy" : "Sell"} of ${fmtQty(pendingDelete.quantity, pendingDelete.asset)} on ${fmtDate(pendingDelete.date)} for ${fmtUsd(pendingDelete.total_usd)}. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
