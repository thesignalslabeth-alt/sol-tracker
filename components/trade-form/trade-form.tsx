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
import { fmtMoney, fmtPrice, fmtQty, fmtSignedPct, fmtSignedUsd, fmtUsd, plClass, todaySg } from "@/lib/format";
import { maxSellable, previewTrade } from "@/lib/position";
import type { Prices } from "@/lib/price";
import { CURRENCIES, CURRENCY_NAMES, type Currency } from "@/lib/currencies";
import { SIDE_LABEL, tradeInputSchema, type Trade, type TradeInput } from "@/lib/trade-schema";
import { AssetPicker } from "./asset-picker";
import { Segmented } from "./segmented";

type FormValues = {
  side: Trade["side"];
  asset: string;
  date: string;
  quantity: string;
  currency: Currency;
  mode: "total" | "price";
  amount: string; // total or price per unit, in `currency`
  fx: string; // units of `currency` per 1 USD, as rates are usually quoted
  fee: string; // in the traded asset (e.g. SOL on Pionex), priced at this trade's own fill
  note: string;
};

type Field = keyof FormValues;

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")));
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const sig = (n: number, digits: number) => Number(n.toPrecision(digits));

/**
 * `original` is the trade being edited: if its amount and rate weren't touched, its
 * stored USD total is kept exactly rather than recomputed through a rounded rate.
 */
function toInput(v: FormValues, original: { values: FormValues; trade: Trade } | null): TradeInput {
  const qty = num(v.quantity);
  const base = { date: v.date, asset: v.asset.trim().toUpperCase(), quantity: qty, note: v.note.trim() || null };
  // A staking reward is quantity received and nothing else: no cost, no fee, no currency.
  if (v.side === "stake") {
    return { ...base, side: "stake", total_usd: 0, fee_usd: 0, quote_currency: "USD", quote_amount: null, fx_usd_per_quote: null };
  }

  const amount = num(v.amount);
  const foreign = v.currency !== "USD";
  const usdPerUnit = foreign ? 1 / num(v.fx) : 1;
  const quoteTotal = v.mode === "total" ? amount : amount * qty;
  const fee = v.fee.trim() === "" ? 0 : num(v.fee);
  const o = original?.values;
  const untouched =
    o && v.mode === "total" && v.currency === o.currency && v.amount === o.amount && v.fx === o.fx;
  const total_usd = untouched ? original!.trade.total_usd : round(quoteTotal * usdPerUnit, 6);
  // Fee is entered in the traded asset (Pionex charges it in SOL) and priced at this
  // trade's own fill, not today's price — a fee on a 2024 buy cost what SOL cost then.
  // When nothing that feeds it was touched, the stored USD value is kept exactly.
  const fillPrice = qty > 0 && total_usd > 0 ? total_usd / qty : 0;
  const feeUntouched = o && v.fee === o.fee && v.quantity === o.quantity && untouched;
  return {
    ...base,
    side: v.side,
    total_usd,
    fee_usd: feeUntouched ? original!.trade.fee_usd : round(fee * fillPrice, 8),
    quote_currency: v.currency,
    quote_amount: foreign ? round(quoteTotal, 6) : null,
    fx_usd_per_quote: foreign ? (untouched ? original!.trade.fx_usd_per_quote : sig(usdPerUnit, 10)) : null,
  };
}

// Maps schema paths onto the form field that produced them.
const FIELD_FOR: Record<string, Field> = {
  date: "date",
  asset: "asset",
  quantity: "quantity",
  total_usd: "amount",
  quote_amount: "amount",
  fx_usd_per_quote: "fx",
  fee_usd: "fee",
  note: "note",
};

/** Live rate for a currency as units per 1 USD, or "" if unknown. */
function liveRate(prices: Prices, c: Currency) {
  const usdPer = prices.usdPer[c];
  return c !== "USD" && usdPer ? String(sig(1 / usdPer, 6)) : "";
}

function defaults(editing: Trade | null, defaultAsset: string, defaultCurrency: Currency, prices: Prices): FormValues {
  if (!editing) {
    return {
      side: "buy",
      asset: defaultAsset,
      date: todaySg(),
      quantity: "",
      currency: defaultCurrency,
      mode: "total",
      amount: "",
      fx: liveRate(prices, defaultCurrency),
      fee: "",
      note: "",
    };
  }
  const foreign = editing.quote_currency !== "USD" && editing.fx_usd_per_quote != null;
  const usdPerUnit = foreign ? editing.fx_usd_per_quote! : 1;
  const fillPrice = editing.quantity > 0 ? editing.total_usd / editing.quantity : 0;
  return {
    side: editing.side,
    asset: editing.asset,
    date: editing.date,
    quantity: String(editing.quantity),
    currency: editing.quote_currency,
    mode: "total",
    amount: String(foreign ? (editing.quote_amount ?? editing.total_usd / usdPerUnit) : editing.total_usd),
    fx: foreign ? String(sig(1 / usdPerUnit, 8)) : "",
    // Fee is stored in USD; show it as the traded asset at this trade's own fill price.
    fee: editing.fee_usd && fillPrice > 0 ? String(round(editing.fee_usd / fillPrice, 8)) : "",
    note: editing.note ?? "",
  };
}

export function TradeForm({
  editing,
  defaultAsset,
  trades,
  prices,
  knownAssets,
  onDone,
}: {
  editing: Trade | null;
  defaultAsset: string;
  trades: Trade[];
  prices: Prices;
  knownAssets: string[];
  onDone: () => void;
}) {
  // New trades default to the currency of the user's most recent trade.
  const lastCurrency = [...trades].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.quote_currency ?? "USD";
  const [initial] = useState(() => defaults(editing, defaultAsset, lastCurrency, prices));
  const { register, control, setValue, handleSubmit, setError, clearErrors, formState } = useForm<FormValues>({
    defaultValues: initial,
  });
  const original = editing ? { values: initial, trade: editing } : null;
  const [saving, startSaving] = useTransition();
  const [draftCreatedAt] = useState(() => new Date().toISOString());
  const v = useWatch({ control }) as FormValues;
  const staking = v.side === "stake";
  const foreign = !staking && v.currency !== "USD";
  const cur = foreign ? v.currency : "$";
  const money = (n: number) =>
    foreign ? fmtMoney(n, v.currency) : `$${round(n, 4).toLocaleString("en-US")}`;
  const input = toInput(v, original);
  const sol = input.quantity;
  const quoteTotal = foreign ? input.quote_amount! : input.total_usd;
  const hasAmounts = sol > 0 && (staking || input.total_usd > 0);
  const fillPrice = sol > 0 && input.total_usd > 0 ? input.total_usd / sol : 0;
  const asset = input.asset;
  const assetKnown = knownAssets.length === 0 || knownAssets.includes(asset);
  const livePrice = prices.usd[asset] ?? 0;
  // Assets this user already trades, most recent first, for the picker's shortlist.
  const heldAssets = [...new Set([...trades].sort((a, b) => b.date.localeCompare(a.date)).map((t) => t.asset))];

  // Cheap enough to recompute every render: the ledger is small.
  const preview =
    hasAmounts && v.date && asset
      ? previewTrade(
          trades,
          { ...input, id: editing?.id ?? "__draft__", created_at: editing?.created_at ?? draftCreatedAt },
          livePrice,
          editing?.id,
        )
      : null;

  const setMax = () => {
    const max = maxSellable(trades, asset, v.date, editing?.id);
    setValue("quantity", String(round(max, 8)), { shouldValidate: false });
    clearErrors("quantity");
  };

  const onSubmit = handleSubmit((values) => {
    const parsed = tradeInputSchema.safeParse(toInput(values, original));
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
        toast.success(editing ? "Trade updated" : `${SIDE_LABEL[values.side]} saved`);
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
          { value: "stake", label: "Staking", activeClass: "bg-primary text-primary-foreground shadow-sm" },
        ]}
      />

      <div className="space-y-1.5">
        <Label>Asset</Label>
        <AssetPicker
          value={asset}
          onChange={(sym) => {
            setValue("asset", sym);
            clearErrors("asset");
          }}
          knownAssets={knownAssets}
          heldAssets={heldAssets}
          prices={prices.usd}
          invalid={!!err("asset") || !assetKnown}
        />
        {err("asset") ? (
          <p className="text-xs text-loss">{err("asset")}</p>
        ) : asset && !assetKnown ? (
          <p className="text-xs text-loss">{asset} has no USDT pair on Binance.</p>
        ) : null}
      </div>

      <div className={cn("grid gap-3", !staking && "grid-cols-2")}>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date{staking && " received"}</Label>
          <Input id="date" type="date" className="h-11 text-base" max={todaySg()} {...reg("date")} />
          {err("date") && <p className="text-xs text-loss">{err("date")}</p>}
        </div>
        {/* A reward has no money side: no currency, total, rate or fee. */}
        <div className={cn("space-y-1.5", staking && "hidden")}>
          <Label htmlFor="currency">Currency</Label>
          {/* Native select: the phone's own picker is the best UI for a long list. */}
          <select
            id="currency"
            value={v.currency}
            onChange={(e) => {
              const c = e.target.value as Currency;
              setValue("currency", c);
              // Switching currency: use the trade's own rate when editing it back, else the live rate.
              setValue("fx", original && c === original.values.currency ? original.values.fx : liveRate(prices, c));
              clearErrors(["fx", "amount"]);
            }}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base dark:bg-input/30"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} · {CURRENCY_NAMES[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="quantity">{asset || "Asset"} {staking ? "received" : "amount"}</Label>
          {v.side === "sell" && (
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={setMax}>
              Max ({fmtQty(maxSellable(trades, asset, v.date, editing?.id), asset)})
            </Button>
          )}
        </div>
        <Input id="quantity" placeholder="0.00" {...decimal} {...reg("quantity")} aria-invalid={!!err("quantity")} />
        {err("quantity") && <p className="text-xs text-loss">{err("quantity")}</p>}
      </div>

      <div className={cn("space-y-1.5", staking && "hidden")}>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="amount">
            {v.mode === "total" ? (v.side === "buy" ? "Total paid" : "Total received") : `Price per ${asset || "coin"}`} ({v.currency})
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
              { value: "price", label: "Per coin" },
            ]}
          />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{cur}</span>
          <Input id="amount" placeholder="0.00" {...decimal} className={cn(decimal.className, foreign ? "pl-14" : "pl-7")} {...reg("amount")} aria-invalid={!!err("amount")} />
        </div>
        {err("amount") ? (
          <p className="text-xs text-loss">{err("amount")}</p>
        ) : (
          hasAmounts && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {v.mode === "total"
                ? `= ${money(quoteTotal / sol)} per ${asset}`
                : `= ${money(quoteTotal)} total`}
              {" · net of fees"}
            </p>
          )
        )}
      </div>

      {foreign && (
        <div className="space-y-1.5">
          <Label htmlFor="fx">Exchange rate</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              1 USD =
            </span>
            <Input
              id="fx"
              placeholder={liveRate(prices, v.currency) || "0"}
              {...decimal}
              className={cn(decimal.className, "pr-14 pl-[4.25rem]")}
              {...reg("fx")}
              aria-invalid={!!err("fx")}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              {v.currency}
            </span>
          </div>
          {err("fx") ? (
            <p className="text-xs text-loss">{err("fx")}</p>
          ) : (
            <p className="text-xs tabular-nums text-muted-foreground">
              {hasAmounts ? `= ${fmtUsd(input.total_usd)} USD · ` : ""}
              {original && v.currency === original.values.currency
                ? "The rate saved with this trade."
                : liveRate(prices, v.currency)
                  ? "Pre-filled from the live rate; edit to match your fill."
                  : "Enter the rate you got."}
            </p>
          )}
        </div>
      )}

      <div className={cn("grid gap-3", !staking && "grid-cols-2")}>
        <div className={cn("space-y-1.5", staking && "hidden")}>
          <Label htmlFor="fee">Fee ({asset || "asset"}, optional)</Label>
          <Input id="fee" placeholder="0" {...decimal} {...reg("fee")} aria-invalid={!!err("fee")} />
          {err("fee") ? (
            <p className="text-xs text-loss">{err("fee")}</p>
          ) : (
            <p className="text-xs tabular-nums text-muted-foreground">
              {v.fee !== "" && fillPrice > 0
                ? `≈ $${round(num(v.fee) * fillPrice, 2)} at this trade's price`
                : "Priced at this trade's own price"}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" rows={1} className="min-h-11 text-base" placeholder="Optional" {...register("note")} />
        </div>
      </div>

      <Preview preview={preview} side={v.side} asset={asset} />

      <Button
        type="submit"
        disabled={saving || !assetKnown || (preview != null && !preview.ok)}
        className={cn(
          "h-12 w-full text-base",
          v.side === "buy" && "bg-gain text-white hover:bg-gain/90",
          v.side === "sell" && "bg-loss text-white hover:bg-loss/90",
        )}
      >
        {saving ? "Saving…" : editing ? "Save changes" : staking ? "Save reward" : `Save ${v.side}`}
      </Button>
    </form>
  );
}

function Preview({
  preview,
  side,
  asset,
}: {
  preview: ReturnType<typeof previewTrade> | null;
  side: Trade["side"];
  asset: string;
}) {
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
            at avg cost {fmtPrice(sale.avgCostAtSale)}.
          </p>
          <p className="text-muted-foreground">Avg cost unchanged · holdings {fmtQty(before.held, asset)} → {fmtQty(after.held, asset)}</p>
        </>
      ) : (
        <>
          <p>
            Avg cost {fmtPrice(before.avgCostBasis)} → <span className="font-semibold">{fmtPrice(after.avgCostBasis)}</span>
          </p>
          <p className="text-muted-foreground">Holdings {fmtQty(before.held, asset)} → {fmtQty(after.held, asset)}</p>
          {side === "stake" && (
            <p className="text-muted-foreground">Free coins: no capital added, so your average cost falls.</p>
          )}
        </>
      )}
    </div>
  );
}
