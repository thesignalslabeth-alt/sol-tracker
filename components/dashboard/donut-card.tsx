"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type Slice = { name: string; value: number; color: string };

// Validated categorical order (see app/globals.css). Fixed, never cycled: callers
// fold anything past the last slot into an "Other" slice.
export const CATEGORICAL = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];
export const OTHER_COLOR = "var(--chart-4)";

export function DonutCard({
  title,
  description,
  slices,
  centerValue,
  centerLabel,
  format,
}: {
  title: string;
  description?: string;
  slices: Slice[];
  centerValue: string;
  centerLabel: string;
  format: (n: number) => string;
}) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
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
                    paddingAngle={data.length > 1 ? 1.5 : 0}
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
                    wrapperStyle={{ zIndex: 10 }}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <ChartTooltip
                          label={String(payload[0].name)}
                          value={`${format(Number(payload[0].value))} · ${pct(Number(payload[0].value))}`}
                        />
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="max-w-[60%] truncate text-xl font-semibold tabular-nums">{centerValue}</span>
                <span className="text-xs text-muted-foreground">{centerLabel}</span>
              </div>
            </div>
            {/* Legend doubles as direct labels: identity never relies on color alone */}
            <ul className="w-full space-y-2 text-sm">
              {data.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {format(s.value)} · {pct(s.value)}
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
