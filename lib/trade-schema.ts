import { z } from "zod";
import { CURRENCIES, type Currency } from "./currencies";

/** A trade as stored. Only raw facts; everything derived is computed in lib/position.ts. */
export type Trade = {
  id: string;
  date: string; // YYYY-MM-DD
  asset: string; // Binance base asset symbol, e.g. "SOL", "BTC"
  side: "buy" | "sell" | "stake"; // stake = a staking reward received, at no cost
  quantity: number; // amount of `asset`
  total_usd: number; // cost for buys, proceeds for sells, net of fees; always 0 for staking
  fee_usd: number;
  quote_currency: Currency;
  quote_amount: number | null;
  fx_usd_per_quote: number | null;
  note: string | null;
  created_at: string; // ISO timestamp, tie-breaker for same-day trades
};

/** How each side is named in the UI. */
export const SIDE_LABEL: Record<Trade["side"], string> = { buy: "Buy", sell: "Sell", stake: "Staking reward" };

const number = (label: string) =>
  z
    .number({ error: (iss) => (Number.isNaN(iss.input) || iss.input == null ? `Enter ${label}` : `${label} must be a number`) })
    .finite();

const positive = (label: string) => number(label).positive(`${label} must be greater than 0`);

/** Input accepted from the entry form. Shared by the client form and the server action. */
export const tradeInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    asset: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,15}$/, "Asset must be a symbol like SOL or BTC"),
    side: z.enum(["buy", "sell", "stake"]),
    quantity: positive("Amount"),
    // Staking rewards cost nothing, so 0 is only valid for them (checked below).
    total_usd: number("USD total").min(0, "USD total can't be negative"),
    fee_usd: z.number().finite().min(0, "Fee can't be negative"),
    quote_currency: z.enum(CURRENCIES),
    quote_amount: positive("Amount in the trade currency").nullable(),
    fx_usd_per_quote: positive("FX rate").nullable(),
    note: z.string().max(500).nullable(),
  })
  .superRefine((t, ctx) => {
    if (t.side === "stake") {
      // A reward is quantity received and nothing else: no cost, no fee, no currency.
      if (t.total_usd !== 0 || t.fee_usd !== 0) {
        ctx.addIssue({ code: "custom", path: ["total_usd"], message: "A staking reward has no cost or fee" });
      }
      return;
    }
    if (t.total_usd <= 0) {
      ctx.addIssue({ code: "custom", path: ["total_usd"], message: "USD total must be greater than 0" });
    }
    if (t.quote_currency !== "USD" && (t.quote_amount == null || t.fx_usd_per_quote == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["quote_amount"],
        message: `${t.quote_currency} trades need a ${t.quote_currency} amount and exchange rate`,
      });
    }
  });

export type TradeInput = z.infer<typeof tradeInputSchema>;

export function normalizeInput(input: TradeInput): TradeInput {
  if (input.side === "stake") {
    return { ...input, total_usd: 0, fee_usd: 0, quote_currency: "USD", quote_amount: null, fx_usd_per_quote: null };
  }
  return input.quote_currency === "USD"
    ? { ...input, quote_amount: null, fx_usd_per_quote: null }
    : input;
}
