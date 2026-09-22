// Creates/migrates the trades table and loads data/trades.json for one user.
// Usage: DATABASE_URL=... SEED_USER_ID=user_... npm run db:seed
// Safe to re-run: existing ids are skipped.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import type { Trade } from "../lib/trade-schema.ts";

const url = process.env.DATABASE_URL;
const userId = process.env.SEED_USER_ID;
if (!url || !userId) {
  console.error("DATABASE_URL and SEED_USER_ID must both be set");
  process.exit(1);
}
const sql = neon(url);

// Migration for tables created before per-user data. Runs before schema.sql so its
// user_id index can be created; rows without an owner go to SEED_USER_ID.
await sql`alter table if exists trades add column if not exists user_id text`;
await sql`alter table if exists trades add column if not exists asset text not null default 'SOL'`;
// sol_amount → quantity (multi-asset). Only renames if the old column still exists.
await sql`
  do $$ begin
    if exists (select 1 from information_schema.columns where table_name = 'trades' and column_name = 'sol_amount') then
      alter table trades rename column sol_amount to quantity;
    end if;
  end $$`;
// Neon's HTTP driver runs one statement per query.
const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
const claimed = await sql`update trades set user_id = ${userId} where user_id is null returning id`;
await sql`alter table trades alter column user_id set not null`;
await sql`create index if not exists trades_user_id_idx on trades (user_id)`;
if (claimed.length) console.log(`Assigned ${claimed.length} existing trades to ${userId}.`);

const trades: Trade[] = JSON.parse(readFileSync(join(process.cwd(), "data/trades.json"), "utf8"));
let inserted = 0;
for (const t of trades) {
  const rows = await sql`
    insert into trades (id, user_id, date, asset, side, quantity, total_usd, fee_usd, quote_currency,
                        quote_amount, fx_usd_per_quote, note, created_at)
    values (${t.id}, ${userId}, ${t.date}, ${t.asset}, ${t.side}, ${t.quantity}, ${t.total_usd}, ${t.fee_usd},
            ${t.quote_currency}, ${t.quote_amount}, ${t.fx_usd_per_quote}, ${t.note}, ${t.created_at})
    on conflict (id) do nothing
    returning id`;
  inserted += rows.length;
}
console.log(`Seed: ${inserted} inserted, ${trades.length - inserted} already present.`);
