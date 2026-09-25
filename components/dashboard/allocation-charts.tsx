"use client";

import { fmtDate, fmtQty, fmtQtyNum, fmtUsdCompact } from "@/lib/format";
import type { AssetPosition, Position } from "@/lib/position";
import { CATEGORICAL, DonutCard, OTHER_COLOR, type Slice } from "./donut-card";

/** One asset: how much of what was bought is still held vs sold in each sale. */
export function AssetAllocationChart({ asset, position: p }: { asset: string; position: Position }) {
  const sales = p.sales.map((s, i) => ({ name: `Sale ${i + 1} · ${fmtDate(s.date)}`, value: s.quantity }));
  // Remaining takes the first slot; the most recent sales follow; older ones fold together.
  const shown =
    sales.length > 3
      ? [{ name: `Earlier sales (${sales.length - 2})`, value: sales.slice(0, -2).reduce((a, s) => a + s.value, 0) }, ...sales.slice(-2)]
      : sales;
  const slices: Slice[] = [
    { name: "Remaining", value: p.held, color: CATEGORICAL[0] },
    ...shown.map((s, i) => ({ ...s, color: CATEGORICAL[i + 1] })),
  ];
  const acquired = slices.reduce((a, s) => a + s.value, 0);
  // Staking rewards are in there too, so "acquired" rather than "bought".
  const staked = p.stakedQuantity > 0 ? `, ${fmtQty(p.stakedQuantity, asset)} of it staking rewards` : "";
  return (
    <DonutCard
      title={`${asset} allocation`}
      description={`${fmtQty(acquired, asset)} acquired in total${staked}`}
      slices={slices}
      centerValue={fmtQtyNum(p.held)}
      centerLabel={`${asset} held`}
      format={(n) => fmtQty(n, asset)}
    />
  );
}

/** All assets: current holdings by market value. */
export function PortfolioAllocationChart({ positions }: { positions: AssetPosition[] }) {
  const valued = positions
    .map((a) => ({ name: a.asset, value: a.position.unrealizedValue }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = valued.length > CATEGORICAL.length ? valued.slice(0, CATEGORICAL.length - 1) : valued;
  const rest = valued.slice(top.length);
  const slices: Slice[] = [
    ...top.map((s, i) => ({ ...s, color: CATEGORICAL[i] })),
    ...(rest.length ? [{ name: `Other (${rest.length})`, value: rest.reduce((a, s) => a + s.value, 0), color: OTHER_COLOR }] : []),
  ];
  const total = valued.reduce((a, s) => a + s.value, 0);
  return (
    <DonutCard
      title="Allocation"
      description="Current holdings by market value"
      slices={slices}
      centerValue={fmtUsdCompact(total)}
      centerLabel="holdings"
      format={fmtUsdCompact}
    />
  );
}
