// Applies db/schema.sql (create-if-not-exists only — no data touched).
// Usage: DATABASE_URL=... npm run db:migrate
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}
const sql = neon(url);

// Neon's HTTP driver runs one statement per query.
const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
const statements = schema.split(";").map((s) => s.trim()).filter(Boolean);
for (const stmt of statements) await sql.query(stmt);
console.log(`Applied ${statements.length} schema statements.`);

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
console.log("Tables:", (tables as { table_name: string }[]).map((t) => t.table_name).join(", "));
