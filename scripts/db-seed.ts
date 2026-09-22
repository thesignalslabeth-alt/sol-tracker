// Creates the trades table and loads data/trades.json into Postgres.
// Usage: DATABASE_URL=... npm run db:seed   (skips ids that already exist)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import type { Trade } from "../lib/trade-schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);

const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
await sql.query(schema);

const trades: Trade[] = JSON.parse(readFileSync(join(process.cwd(), "data/trades.json"), "utf8"));
for (const t of trades) {
  await sql`
    insert into trades (id, date, side, sol_amount, total_usd, fee_usd, quote_currency,
                        quote_amount, fx_usd_per_quote, note, created_at)
    values (${t.id}, ${t.date}, ${t.side}, ${t.sol_amount}, ${t.total_usd}, ${t.fee_usd},
            ${t.quote_currency}, ${t.quote_amount}, ${t.fx_usd_per_quote}, ${t.note}, ${t.created_at})
    on conflict (id) do nothing`;
}
console.log(`Seeded ${trades.length} trades.`);
