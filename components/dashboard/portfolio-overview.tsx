import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtPrice, fmtQty, fmtSignedPct, fmtSignedUsd, fmtUsd, fmtUsdCompact, plClass } from "@/lib/format";
import type { AssetPosition } from "@/lib/position";

export function portfolioTotals(positions: AssetPosition[]) {
  const sum = (f: (a: AssetPosition) => number) => positions.reduce((acc, a) => acc + f(a), 0);
  const deployed = sum((a) => a.position.totalCapitalDeployed);
  const totalPL = sum((a) => a.position.totalPL);
  return {
    holdings: sum((a) => a.position.unrealizedValue),
    deployed,
    realized: sum((a) => a.position.realizedPL),
    unrealized: sum((a) => a.position.unrealizedPL),
    totalPL,
    totalPct: deployed > 0 ? (totalPL / deployed) * 100 : 0,
    missingPrices: positions.filter((a) => a.price == null && a.position.held > 0).map((a) => a.asset),
  };
}

export function PortfolioOverview({ positions }: { positions: AssetPosition[] }) {
  const t = portfolioTotals(positions);
  const cards = [
    { label: "Holdings value", value: fmtUsdCompact(t.holdings), sub: `${positions.length} assets` },
    { label: "Total P/L", value: fmtSignedUsd(t.totalPL), sub: fmtSignedPct(t.totalPct), tone: t.totalPL },
    { label: "Realized P/L", value: fmtSignedUsd(t.realized), tone: t.realized, sub: "Locked in" },
    { label: "Unrealized P/L", value: fmtSignedUsd(t.unrealized), tone: t.unrealized, sub: "At live prices" },
  ];

  return (
    <>
      <section aria-label="Portfolio totals" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="gap-0 py-3 md:py-4">
            <CardContent className="px-3 md:px-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={cn("mt-1 truncate text-lg font-semibold tabular-nums md:text-2xl", c.tone != null && plClass(c.tone))}>
                {c.value}
              </p>
              <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {t.missingPrices.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No live price for {t.missingPrices.join(", ")}; valued at $0 until one is available.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          {/* Mobile: tappable cards */}
          <ul className="space-y-2 md:hidden">
            {positions.map(({ asset, price, position: p }) => (
              <li key={asset}>
                <Link href={`/?asset=${asset}`} className="flex min-h-11 items-center gap-3 rounded-lg border p-3 active:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{asset}</p>
                    <p className="truncate text-sm tabular-nums text-muted-foreground">
                      {fmtQty(p.held, asset)} · avg {fmtPrice(p.avgCostBasis)}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-medium">{price != null ? fmtUsd(p.unrealizedValue) : "—"}</p>
                    <p className={cn("text-sm", plClass(p.totalPL))}>{price != null ? fmtSignedPct(p.totalProfitPct) : ""}</p>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Held</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                  <TableHead className="text-right">Total P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map(({ asset, price, position: p }) => (
                  <TableRow key={asset} className="relative">
                    <TableCell className="font-semibold">
                      {/* Stretched link: the whole row opens the asset */}
                      <Link href={`/?asset=${asset}`} className="after:absolute after:inset-0 hover:underline">
                        {asset}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtQty(p.held, asset)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPrice(p.avgCostBasis)}</TableCell>
                    <TableCell className="text-right tabular-nums">{price != null ? fmtPrice(price) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{price != null ? fmtUsd(p.unrealizedValue) : "—"}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", plClass(p.realizedPL))}>{fmtSignedUsd(p.realizedPL)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", plClass(p.totalPL))}>
                      {price != null ? (
                        <>
                          {fmtSignedUsd(p.totalPL)} <span className="text-xs">({fmtSignedPct(p.totalProfitPct)})</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
