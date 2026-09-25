"use client";

import { useState, useTransition } from "react";
import { AlertTriangleIcon, CheckIcon, FileUpIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { importTrades } from "@/app/actions";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseTradesCsv, TEMPLATE_HEADERS, type ParseResult } from "@/lib/csv";
import { fmtDate, fmtQty, fmtUsd } from "@/lib/format";

const MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_ROWS = 100;

const TEMPLATE =
  TEMPLATE_HEADERS.join(",") +
  "\n2026-08-01,SOL,buy,10,725.50,USD,,,,Example buy" +
  "\n2026-08-27,SOL,sell,5,640,SGD,0.7868,,,Example SGD sell" +
  "\n2026-09-02,BTC,buy,0.01,3480,MYR,0.2451,,,Example MYR buy\n";
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

export function ImportSheet({
  open,
  onOpenChange,
  knownAssets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownAssets: string[];
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, startImport] = useTransition();

  const reset = () => {
    setFileName(null);
    setResult(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 5 MB.");
      return;
    }
    setFileName(file.name);
    setResult(parseTradesCsv(await file.text(), new Set(knownAssets)));
  };

  const rows = result?.format ? result.rows : [];
  const ready = rows.filter((r) => r.input);
  const failed = rows.filter((r) => r.error);

  const doImport = () => {
    startImport(async () => {
      const res = await importTrades(
        ready.map((r) => ({ fingerprint: r.fingerprint, input: r.input, createdAt: r.createdAt })),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.skipped
          ? `Imported ${res.inserted} trades · ${res.skipped} already present`
          : `Imported ${res.inserted} trades`,
      );
      reset();
      onOpenChange(false);
    });
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Import CSV"
      description="Binance spot trade history, or the template below."
      className="sm:max-w-2xl"
    >
      <div className="space-y-4 pb-4">
        {!result ? (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center hover:bg-muted/50">
              <FileUpIcon className="size-8 text-muted-foreground" />
              <span className="font-medium">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Up to 5 MB</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">From Binance:</span> Orders → Spot Order → Trade History →
                Export. Only pairs quoted in USD stablecoins (USDT, USDC, FDUSD…) are imported.
              </p>
              <p>
                <span className="font-medium text-foreground">Anything else:</span>{" "}
                <a href={TEMPLATE_HREF} download="trade-template.csv" className="underline underline-offset-4">
                  download the template
                </a>
                . Re-importing the same file skips rows already imported.
              </p>
            </div>
          </>
        ) : result.format === null ? (
          <div className="space-y-3">
            <p role="alert" className="rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
              {result.error}
            </p>
            <Button variant="outline" className="h-11 w-full" onClick={reset}>
              Choose another file
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="truncate font-medium">{fileName}</span>
              <span className="text-muted-foreground">{result.format === "binance" ? "Binance export" : "Template"}</span>
              <span className="text-gain">{ready.length} ready</span>
              {failed.length > 0 && <span className="text-loss">{failed.length} with errors (skipped)</span>}
            </div>

            <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border text-sm">
              {rows.slice(0, PREVIEW_ROWS).map((r) => (
                <li key={r.line} className="flex items-start gap-2 p-2">
                  {r.error ? (
                    <XIcon className="mt-0.5 size-4 shrink-0 text-loss" aria-label="Error" />
                  ) : r.warning ? (
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" aria-label="Warning" />
                  ) : (
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-gain" aria-label="Ready" />
                  )}
                  <div className="min-w-0 flex-1">
                    {r.input ? (
                      <p className="tabular-nums">
                        <span
                          className={cn(
                            "font-medium uppercase",
                            r.input.side === "buy" ? "text-gain" : r.input.side === "sell" ? "text-loss" : "text-primary",
                          )}
                        >
                          {r.input.side}
                        </span>{" "}
                        {fmtQty(r.input.quantity, r.input.asset)}
                        {r.input.side === "stake" ? " received" : ` for ${fmtUsd(r.input.total_usd)}`}
                        <span className="text-muted-foreground"> · {fmtDate(r.input.date)}</span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Line {r.line}</p>
                    )}
                    {(r.error || r.warning) && (
                      <p className={cn("text-xs", r.error ? "text-loss" : "text-amber-600 dark:text-amber-400")}>
                        {r.error ?? r.warning}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {rows.length > PREVIEW_ROWS && (
                <li className="p-2 text-center text-xs text-muted-foreground">
                  …and {rows.length - PREVIEW_ROWS} more rows
                </li>
              )}
            </ul>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="h-11" onClick={reset} disabled={importing}>
                Choose another file
              </Button>
              <Button className="h-11" onClick={doImport} disabled={importing || ready.length === 0}>
                {importing ? "Importing…" : `Import ${ready.length} ${ready.length === 1 ? "trade" : "trades"}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
