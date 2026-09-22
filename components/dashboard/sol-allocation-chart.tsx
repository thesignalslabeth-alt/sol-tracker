"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtSol } from "@/lib/format";
import type { Position } from "@/lib/position";

// Fixed order, never cycled: Remaining first, then the most recent sales.
// More than three sales fold the oldest into "Earlier sales".
const SALE_COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];

type Slice = { name: string; value: number; color: string };

function slices(p: Position): Slice[] {
  const sales = p.sales.map((s, i) => ({ name: `Sale ${i + 1} · ${fmtDate(s.date)}`, value: s.solAmount }));
  const shown =
    sales.length > 3
      ? [
          { name: `Earlier sales (${sales.length - 2})`, value: sales.slice(0, -2).reduce((a, s) => a + s.value, 0) },
          ...sales.slice(-2),
        ]
      : sales;
  return [
    { name: "Remaining", value: p.solHeld, color: "var(--chart-1)" },
    ...shown.map((s, i) => ({ ...s, color: SALE_COLORS[i] })),
  ].filter((s) => s.value > 0);
}

export function SolAllocationChart({ position }: { position: Position }) {
  const data = slices(position);
  const total = data.reduce((a, s) => a + s.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SOL allocation</CardTitle>
        <CardDescription>{fmtSol(total)} bought in total</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No trades yet.</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[200px] w-full max-w-[240px] shrink-0 lg:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="95%"
                    paddingAngle={1.5}
                    cornerRadius={4}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {data.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <ChartTooltip
                          label={String(payload[0].name)}
                          value={`${fmtSol(Number(payload[0].value))} · ${((Number(payload[0].value) / total) * 100).toFixed(1)}%`}
                        />
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold tabular-nums">{fmtSol(position.solHeld).replace(" SOL", "")}</span>
                <span className="text-xs text-muted-foreground">SOL held</span>
              </div>
            </div>
            {/* Legend doubles as direct labels: identity never relies on color alone */}
            <ul className="w-full space-y-2 text-sm">
              {data.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtSol(s.value)} · {((s.value / total) * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChartTooltip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label}</p>
      <p className="tabular-nums text-muted-foreground">{value}</p>
    </div>
  );
}
