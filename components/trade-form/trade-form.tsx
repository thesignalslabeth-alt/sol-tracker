"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createTrade, updateTrade } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fmtSignedPct, fmtSignedUsd, fmtSol, fmtUsd, plClass, todaySg } from "@/lib/format";
import { maxSellable, previewTrade } from "@/lib/position";
import type { SolPrice } from "@/lib/price";
import { tradeInputSchema, type Trade, type TradeInput } from "@/lib/trade-schema";
import { Segmented } from "./segmented";

type FormValues = {
  side: "buy" | "sell";
  date: string;
  sol_amount: string;
  currency: "USD" | "SGD";
  mode: "total" | "price";
  amount: string; // total or price per SOL, in `currency`
  fx: string; // USD per SGD
  fee: string; // in `currency`
  note: string;
};

type Field = keyof FormValues;

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

function toInput(v: FormValues): TradeInput {
  const sol = num(v.sol_amount);
  const amount = num(v.amount);
  const fx = v.currency === "SGD" ? num(v.fx) : 1;
  const quoteTotal = v.mode === "total" ? amount : amount * sol;
  const fee = v.fee.trim() === "" ? 0 : num(v.fee);
  return {
    date: v.date,
    side: v.side,
    sol_amount: sol,
    total_usd: round(quoteTotal * fx, 6),
    fee_usd: round(fee * fx, 6),
    quote_currency: v.currency,
    quote_amount: v.currency === "SGD" ? round(quoteTotal, 6) : null,
    fx_usd_per_quote: v.currency === "SGD" ? fx : null,
    note: v.note.trim() || null,
  };
}

// Maps schema paths onto the form field that produced them.
const FIELD_FOR: Record<string, Field> = {
  date: "date",
  sol_amount: "sol_amount",
  total_usd: "amount",
  quote_amount: "amount",
  fx_usd_per_quote: "fx",
  fee_usd: "fee",
  note: "note",
};

function defaults(editing: Trade | null, price: SolPrice): FormValues {
  const liveFx = price.usd && price.sgd ? String(round(price.usd / price.sgd, 6)) : "";
  if (!editing) {
    return { side: "buy", date: todaySg(), sol_amount: "", currency: "USD", mode: "total", amount: "", fx: liveFx, fee: "", note: "" };
  }
  const sgd = editing.quote_currency === "SGD";
  const fx = sgd ? (editing.fx_usd_per_quote ?? 1) : 1;
  return {
    side: editing.side,
    date: editing.date,
    sol_amount: String(editing.sol_amount),
    currency: editing.quote_currency,
    mode: "total",
    amount: String(sgd ? (editing.quote_amount ?? editing.total_usd / fx) : editing.total_usd),
    fx: sgd ? String(fx) : liveFx,
    fee: editing.fee_usd ? String(round(editing.fee_usd / fx, 2)) : "",
    note: editing.note ?? "",
  };
}

export function TradeForm({
  editing,
  trades,
  price,
  onDone,
}: {
  editing: Trade | null;
  trades: Trade[];
  price: SolPrice;
  onDone: () => void;
}) {
  const { register, control, setValue, handleSubmit, setError, clearErrors, formState } = useForm<FormValues>({
    defaultValues: defaults(editing, price),
  });
  const [saving, startSaving] = useTransition();
  const [draftCreatedAt] = useState(() => new Date().toISOString());
  const v = useWatch({ control }) as FormValues;
  const cur = v.currency === "SGD" ? "S$" : "$";
  const input = toInput(v);
  const sol = input.sol_amount;
  const quoteTotal = v.currency === "SGD" ? input.quote_amount! : input.total_usd;
  const hasAmounts = sol > 0 && input.total_usd > 0;

  // Cheap enough to recompute every render: the ledger is small.
  const preview =
    hasAmounts && v.date
      ? previewTrade(
          trades,
          { ...input, id: editing?.id ?? "__draft__", created_at: editing?.created_at ?? draftCreatedAt },
          price.usd ?? 0,
          editing?.id,
        )
      : null;

  const setMax = () => {
    const max = maxSellable(trades, v.date, editing?.id);
    setValue("sol_amount", String(round(max, 8)), { shouldValidate: false });
    clearErrors("sol_amount");
  };

  const onSubmit = handleSubmit((values) => {
    const parsed = tradeInputSchema.safeParse(toInput(values));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = FIELD_FOR[String(issue.path[0])] ?? "amount";
        setError(field, { message: issue.message });
      }
      return;
    }
    if (preview && !preview.ok) return;
    startSaving(async () => {
      const res = editing ? await updateTrade(editing.id, parsed.data) : await createTrade(parsed.data);
      if (res.ok) {
        toast.success(editing ? "Trade updated" : `${values.side === "buy" ? "Buy" : "Sell"} saved`);
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  });

  const err = (f: Field) => formState.errors[f]?.message;
  // Clear a field's submit error as soon as it's edited.
  const reg = (f: Field) => register(f, { onChange: () => clearErrors(f) });
  const decimal = { inputMode: "decimal" as const, autoComplete: "off", className: "h-11 text-base tabular-nums" };

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-4" noValidate>
      <Segmented
        label="Side"
        value={v.side}
        onChange={(s) => setValue("side", s)}
        options={[
          { value: "buy", label: "Buy", activeClass: "bg-gain text-white shadow-sm" },
          { value: "sell", label: "Sell", activeClass: "bg-loss text-white shadow-sm" },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" className="h-11 text-base" max={todaySg()} {...reg("date")} />
          {err("date") && <p className="text-xs text-loss">{err("date")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Segmented
            label="Currency"
            value={v.currency}
            onChange={(c) => setValue("currency", c)}
            options={[
              { value: "USD", label: "USD" },
              { value: "SGD", label: "SGD" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sol_amount">SOL amount</Label>
          {v.side === "sell" && (
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={setMax}>
              Max ({fmtSol(maxSellable(trades, v.date, editing?.id))})
            </Button>
          )}
        </div>
        <Input id="sol_amount" placeholder="0.00" {...decimal} {...reg("sol_amount")} aria-invalid={!!err("sol_amount")} />
        {err("sol_amount") && <p className="text-xs text-loss">{err("sol_amount")}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="amount">
            {v.mode === "total" ? (v.side === "buy" ? "Total paid" : "Total received") : "Price per SOL"} ({v.currency})
          </Label>
          <Segmented
            label="Entry mode"
            className="w-40 [&_button]:h-8 [&_button]:text-xs"
            value={v.mode}
            onChange={(m) => {
              // Keep the same trade when switching modes
              if (sol > 0 && quoteTotal > 0) {
                setValue("amount", String(round(m === "total" ? quoteTotal : quoteTotal / sol, 6)));
              }
              setValue("mode", m);
            }}
            options={[
              { value: "total", label: "Total" },
              { value: "price", label: "Per SOL" },
            ]}
          />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{cur}</span>
          <Input id="amount" placeholder="0.00" {...decimal} className={cn(decimal.className, v.currency === "SGD" ? "pl-9" : "pl-7")} {...reg("amount")} aria-invalid={!!err("amount")} />
        </div>
        {err("amount") ? (
          <p className="text-xs text-loss">{err("amount")}</p>
        ) : (
          hasAmounts && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {v.mode === "total"
                ? `= ${cur}${round(quoteTotal / sol, 4).toLocaleString("en-US")} per SOL`
                : `= ${cur}${round(quoteTotal, 2).toLocaleString("en-US")} total`}
              {" · net of fees"}
            </p>
          )
        )}
      </div>

      {v.currency === "SGD" && (
        <div className="space-y-1.5">
          <Label htmlFor="fx">FX rate (USD per 1 SGD)</Label>
          <Input id="fx" placeholder="0.78" {...decimal} {...reg("fx")} aria-invalid={!!err("fx")} />
          {err("fx") ? (
            <p className="text-xs text-loss">{err("fx")}</p>
          ) : (
            <p className="text-xs tabular-nums text-muted-foreground">
              {hasAmounts ? `= ${fmtUsd(input.total_usd)} USD` : "Pre-filled from the live rate; edit to match your fill."}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fee">Fee ({v.currency}, optional)</Label>
          <Input id="fee" placeholder="0" {...decimal} {...reg("fee")} aria-invalid={!!err("fee")} />
          {err("fee") && <p className="text-xs text-loss">{err("fee")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" rows={1} className="min-h-11 text-base" placeholder="Optional" {...register("note")} />
        </div>
      </div>

      <Preview preview={preview} side={v.side} />

      <Button
        type="submit"
        disabled={saving || (preview != null && !preview.ok)}
        className={cn("h-12 w-full text-base text-white", v.side === "buy" ? "bg-gain hover:bg-gain/90" : "bg-loss hover:bg-loss/90")}
      >
        {saving ? "Saving…" : editing ? "Save changes" : v.side === "buy" ? "Save buy" : "Save sell"}
      </Button>
    </form>
  );
}

function Preview({ preview, side }: { preview: ReturnType<typeof previewTrade> | null; side: "buy" | "sell" }) {
  if (!preview) {
    return <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Enter an amount to preview the impact.</div>;
  }
  if (!preview.ok) {
    return (
      <div role="alert" className="rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
        {preview.error}.
      </div>
    );
  }
  const { before, after, sale } = preview;
  return (
    <div className="space-y-1 rounded-lg bg-muted p-3 text-sm tabular-nums" aria-live="polite">
      {side === "sell" && sale ? (
        <>
          <p>
            Realizes{" "}
            <span className={cn("font-semibold", plClass(sale.realizedPL))}>
              {fmtSignedUsd(sale.realizedPL)} ({fmtSignedPct(sale.realizedPct)})
            </span>{" "}
            at avg cost {fmtUsd(sale.avgCostAtSale)}.
          </p>
          <p className="text-muted-foreground">Avg cost unchanged · holdings {fmtSol(before.solHeld)} → {fmtSol(after.solHeld)}</p>
        </>
      ) : (
        <>
          <p>
            Avg cost {fmtUsd(before.avgCostBasis)} → <span className="font-semibold">{fmtUsd(after.avgCostBasis)}</span>
          </p>
          <p className="text-muted-foreground">Holdings {fmtSol(before.solHeld)} → {fmtSol(after.solHeld)}</p>
        </>
      )}
    </div>
  );
}
