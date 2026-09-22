import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtPrice, fmtQty, fmtSignedPct, fmtSignedUsd, fmtUsdCompact, plClass } from "@/lib/format";
import type { Position } from "@/lib/position";

type Metric = { label: string; value: string; sub?: string; tone?: number };

export function MetricCards({ asset, position: p, price }: { asset: string; position: Position; price: number | null }) {
  const live = price != null;
  const dash = "—";
  const vsAvg = live && p.avgCostBasis > 0 ? ((price - p.avgCostBasis) / p.avgCostBasis) * 100 : null;

  const metrics: Metric[] = [
    {
      label: "Current price",
      value: live ? fmtPrice(price) : dash,
      sub: vsAvg != null ? `${fmtSignedPct(vsAvg)} vs avg cost` : undefined,
      tone: vsAvg ?? undefined,
    },
    {
      label: "Total P/L",
      value: live ? fmtSignedUsd(p.totalPL) : dash,
      sub: live ? fmtSignedPct(p.totalProfitPct) : undefined,
      tone: live ? p.totalPL : undefined,
    },
    { label: "Portfolio value", value: live ? fmtUsdCompact(p.totalPortfolioValue) : dash, sub: `Cash + ${asset}` },
    { label: "Avg cost basis", value: fmtPrice(p.avgCostBasis), sub: `${fmtQty(p.held, asset)} held` },
    {
      label: "Realized P/L",
      value: fmtSignedUsd(p.realizedPL),
      sub: `${fmtUsdCompact(p.totalRealizedCash)} cashed out`,
      tone: p.realizedPL,
    },
    {
      label: "Unrealized P/L",
      value: live ? fmtSignedUsd(p.unrealizedPL) : dash,
      sub: `on ${fmtUsdCompact(p.remainingCostBasis)} basis`,
      tone: live ? p.unrealizedPL : undefined,
    },
    { label: "Break-even price", value: fmtPrice(p.breakEvenPrice), sub: "Whole trade flat" },
    { label: "Capital deployed", value: fmtUsdCompact(p.totalCapitalDeployed), sub: "Total bought" },
  ];

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="gap-0 py-3 md:py-4">
          <CardContent className="px-3 md:px-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p
              className={cn(
                "mt-1 truncate text-lg font-semibold tabular-nums md:text-2xl",
                m.tone != null && plClass(m.tone),
              )}
            >
              {m.value}
            </p>
            {m.sub && (
              <p className={cn("mt-0.5 truncate text-xs tabular-nums text-muted-foreground")}>{m.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
