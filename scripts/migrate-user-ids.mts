// Re-owns trades when users move to a different Clerk instance (their user IDs change).
// Usage: DATABASE_URL=... npm run db:migrate-users -- <mapping.json> [--dry-run]
// mapping.json: { "<old user id>": "<new user id>", ... }. All-or-nothing (one transaction).
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const [file, flag] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url || !file) {
  console.error("Usage: DATABASE_URL=... npm run db:migrate-users -- <mapping.json> [--dry-run]");
  process.exit(1);
}
const dryRun = flag === "--dry-run";
const mapping: Record<string, string> = JSON.parse(readFileSync(file, "utf8"));
const entries = Object.entries(mapping);
if (entries.some(([from, to]) => !/^user_\w+$/.test(from) || !/^user_\w+$/.test(to) || from === to)) {
  console.error("Mapping must be { old user_… : new user_… } with distinct IDs.");
  process.exit(1);
}

const sql = neon(url);
const count = async (id: string) => Number((await sql`select count(*) as n from trades where user_id = ${id}`)[0].n);

for (const [from, to] of entries) {
  console.log(`${from} (${await count(from)} trades) → ${to} (${await count(to)} trades)`);
}
if (dryRun) {
  console.log("Dry run: nothing changed.");
  process.exit(0);
}

await sql.transaction(entries.map(([from, to]) => sql`update trades set user_id = ${to} where user_id = ${from}`));

for (const [from, to] of entries) {
  console.log(`after: ${from} = ${await count(from)} trades, ${to} = ${await count(to)} trades`);
}
