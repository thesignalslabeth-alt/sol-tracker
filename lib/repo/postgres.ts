import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Trade } from "../trade-schema";
import type { TradesRepo } from "../trades-repo";

type Row = Record<keyof Trade, unknown>;

const num = (v: unknown) => (v == null ? null : Number(v));

// numeric columns arrive as strings; dates as Date objects.
function toTrade(r: Row): Trade {
  return {
    id: String(r.id),
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    asset: String(r.asset),
    side: r.side as Trade["side"],
    quantity: Number(r.quantity),
    total_usd: Number(r.total_usd),
    fee_usd: Number(r.fee_usd),
    quote_currency: r.quote_currency as Trade["quote_currency"],
    quote_amount: num(r.quote_amount),
    fx_usd_per_quote: num(r.fx_usd_per_quote),
    note: (r.note as string | null) ?? null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/** Production store: Neon Postgres. Schema in db/schema.sql. */
export class PostgresTradesRepo implements TradesRepo {
  private sql = (() => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    return neon(url);
  })();

  async list(userId: string) {
    const rows = await this.sql`
      select id, to_char(date, 'YYYY-MM-DD') as date, asset, side, quantity, total_usd, fee_usd,
             quote_currency, quote_amount, fx_usd_per_quote, note, created_at
      from trades
      where user_id = ${userId}`;
    return (rows as Row[]).map(toTrade);
  }

  async create(userId: string, t: Trade) {
    await this.sql`
      insert into trades (id, user_id, date, asset, side, quantity, total_usd, fee_usd, quote_currency,
                          quote_amount, fx_usd_per_quote, note, created_at)
      values (${t.id}, ${userId}, ${t.date}, ${t.asset}, ${t.side}, ${t.quantity}, ${t.total_usd}, ${t.fee_usd},
              ${t.quote_currency}, ${t.quote_amount}, ${t.fx_usd_per_quote}, ${t.note}, ${t.created_at})`;
  }

  async createMany(userId: string, trades: Trade[]) {
    if (trades.length === 0) return 0;
    // One statement: unnest parallel arrays into rows.
    const col = <K extends keyof Trade>(k: K) => trades.map((t) => t[k]);
    const rows = await this.sql`
      insert into trades (id, user_id, date, asset, side, quantity, total_usd, fee_usd, quote_currency,
                          quote_amount, fx_usd_per_quote, note, created_at)
      select id, ${userId}, date, asset, side, quantity, total_usd, fee_usd, quote_currency,
             quote_amount, fx_usd_per_quote, note, created_at
      from unnest(${col("id")}::text[], ${col("date")}::date[], ${col("asset")}::text[], ${col("side")}::text[],
                  ${col("quantity")}::numeric[], ${col("total_usd")}::numeric[], ${col("fee_usd")}::numeric[],
                  ${col("quote_currency")}::text[], ${col("quote_amount")}::numeric[],
                  ${col("fx_usd_per_quote")}::numeric[], ${col("note")}::text[], ${col("created_at")}::timestamptz[])
        as t(id, date, asset, side, quantity, total_usd, fee_usd, quote_currency, quote_amount,
             fx_usd_per_quote, note, created_at)
      on conflict (id) do nothing
      returning id`;
    return rows.length;
  }

  async update(userId: string, t: Trade) {
    const rows = await this.sql`
      update trades set date = ${t.date}, asset = ${t.asset}, side = ${t.side}, quantity = ${t.quantity},
        total_usd = ${t.total_usd}, fee_usd = ${t.fee_usd}, quote_currency = ${t.quote_currency},
        quote_amount = ${t.quote_amount}, fx_usd_per_quote = ${t.fx_usd_per_quote}, note = ${t.note}
      where id = ${t.id} and user_id = ${userId}
      returning id`;
    if (rows.length === 0) throw new Error(`Trade ${t.id} not found`);
  }

  async remove(userId: string, id: string) {
    await this.sql`delete from trades where id = ${id} and user_id = ${userId}`;
  }
}
