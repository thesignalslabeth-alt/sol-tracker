import { z } from "zod";

/** A trade as stored. Only raw facts; everything derived is computed in lib/position.ts. */
export type Trade = {
  id: string;
  date: string; // YYYY-MM-DD
  side: "buy" | "sell";
  sol_amount: number;
  total_usd: number; // cost for buys, proceeds for sells, net of fees
  fee_usd: number;
  quote_currency: "USD" | "SGD";
  quote_amount: number | null;
  fx_usd_per_quote: number | null;
  note: string | null;
  created_at: string; // ISO timestamp, tie-breaker for same-day trades
};

const positive = (label: string) =>
  z
    .number({ error: (iss) => (Number.isNaN(iss.input) || iss.input == null ? `Enter ${label}` : `${label} must be a number`) })
    .finite()
    .positive(`${label} must be greater than 0`);

/** Input accepted from the entry form. Shared by the client form and the server action. */
export const tradeInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    side: z.enum(["buy", "sell"]),
    sol_amount: positive("SOL amount"),
    total_usd: positive("USD total"),
    fee_usd: z.number().finite().min(0, "Fee can't be negative"),
    quote_currency: z.enum(["USD", "SGD"]),
    quote_amount: positive("SGD amount").nullable(),
    fx_usd_per_quote: positive("FX rate").nullable(),
    note: z.string().max(500).nullable(),
  })
  .superRefine((t, ctx) => {
    if (t.quote_currency === "SGD" && (t.quote_amount == null || t.fx_usd_per_quote == null)) {
      ctx.addIssue({ code: "custom", path: ["quote_amount"], message: "SGD trades need an SGD amount and FX rate" });
    }
  });

export type TradeInput = z.infer<typeof tradeInputSchema>;

export function normalizeInput(input: TradeInput): TradeInput {
  return input.quote_currency === "USD"
    ? { ...input, quote_amount: null, fx_usd_per_quote: null }
    : input;
}
