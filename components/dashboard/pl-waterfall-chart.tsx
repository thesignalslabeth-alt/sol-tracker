"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtSignedUsd, fmtUsd } from "@/lib/format";
import type { Position } from "@/lib/position";
import { ChartTooltip } from "./donut-card";

type Step = { name: string; base: number; size: number; color: string; label: string; detail: string };

const compactAxis = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Capital deployed + realized P/L + unrealized P/L = total portfolio value. */
function steps(p: Position): Step[] {
  const d = p.totalCapitalDeployed;
  const r = p.realizedPL;
  const u = p.unrealizedPL;
  const delta = (start: number, change: number) => ({ base: Math.min(start, start + change), size: Math.abs(change) });
  const tone = (n: number) => (n >= 0 ? "var(--gain)" : "var(--loss)");
  const short = (n: number) => `$${compactAxis.format(n)}`;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${short(Math.abs(n))}`;
  return [
    { name: "Deployed", base: 0, size: d, color: "var(--chart-4)", label: short(d), detail: fmtUsd(d) },
    { name: "Realized", ...delta(d, r), color: tone(r), label: signed(r), detail: fmtSignedUsd(r) },
    { name: "Unrealized", ...delta(d + r, u), color: tone(u), label: signed(u), detail: fmtSignedUsd(u) },
    { name: "Total", base: 0, size: p.totalPortfolioValue, color: "var(--chart-1)", label: short(p.totalPortfolioValue), detail: fmtUsd(p.totalPortfolioValue) },
  ];
}

export function PLWaterfallChart({ position, priceAvailable }: { position: Position; priceAvailable: boolean }) {
  const data = steps(position);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the value came from</CardTitle>
        <CardDescription>Capital deployed + realized + unrealized = portfolio value</CardDescription>
      </CardHeader>
      <CardContent>
        {!priceAvailable ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Live price unavailable.</p>
        ) : (
          <div className="h-[220px] w-full lg:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `$${compactAxis.format(v)}`}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    const s = payload?.[0]?.payload as Step | undefined;
                    return active && s ? <ChartTooltip label={s.name} value={s.detail} /> : null;
                  }}
                />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="size" stackId="w" radius={4} isAnimationActive={false}>
                  {data.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                  <LabelList dataKey="label" position="top" fontSize={11} fill="var(--foreground)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
