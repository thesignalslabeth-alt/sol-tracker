# SOL Tracker

Personal dashboard for a SOL spot position: moving-average cost basis,
realized and unrealized P/L, portfolio value and break-even price, with a live price
from CoinGecko. Mobile-first; trades are logged in the app.

Stack: Next.js 16 (App Router) · Tailwind v4 + shadcn/ui · Recharts · Clerk · Neon Postgres.
No Vite anywhere; tests use Node's built-in runner.

## Run locally

```bash
npm install
cp .env.example .env.local   # leave the Clerk keys blank to start
npm run dev
```

Open http://localhost:3000. With `TRADES_STORE=json`, trades are read from and written
to `data/trades.json`. Without Clerk keys, local dev runs **with auth off** and shows a
banner; a production build refuses to serve until keys are set.

## Tests

```bash
npm test
```

`lib/position.test.ts` checks the seed data reproduces the known figures (avg cost
$72.47, realized P/L $1,628.63, remaining basis $2,898.90, break-even $31.76) plus
re-averaging, oversell and back-dated-sell cases.

## Adding a trade

Tap **Add trade** (bottom of the screen on mobile, top right on desktop):

1. Pick **Buy** or **Sell**, the date and the currency.
2. Enter the SOL amount and either the **total** or the **price per SOL**, net of fees.
   For sells, **Max** fills the most you can sell on that date.
3. For **SGD**, the FX rate (USD per 1 SGD) is pre-filled from the live rate; change it to
   match your actual fill. Example: sold 33 SOL for S$4,270 at 0.786782 → $3,359.56.
4. Check the preview ("Avg cost $72.47 → $77.98", or "Realizes +$660.66"), then save.

Each signed-in user has their own ledger: a new user starts empty and can never see
anyone else's trades. Every add, edit and delete re-checks the whole ledger, so a sell can never end up larger
than what you held at that date.

**How cost basis works:** moving average cost. A buy re-averages your cost; a sell
removes SOL at the current average and leaves the average unchanged.

## Clerk setup

1. Create an application in the Clerk dashboard and copy its keys into `.env.local`
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
2. Optional: restrict who can use the app with `ALLOWED_USER_IDS` (comma-separated).
   Leave it empty to let anyone who signs in use it with their own empty ledger.
   Someone who isn't on a non-empty list sees **Not authorized** with their user ID.
3. Set `SEED_USER_ID` to your ID so the committed seed trades show up as yours locally.

Every server action and API route calls `requireOwner()` (`lib/auth.ts`), which returns
the signed-in user's ID; all storage calls are scoped by it.

## Deploying to Vercel

Vercel's filesystem is read-only, so production uses Postgres:

1. Add **Neon** from the Vercel Marketplace; it sets `DATABASE_URL`.
2. Set `TRADES_STORE=postgres`, the Clerk keys and `ALLOWED_USER_IDS` in the project's env vars.
3. Create the table and load the seed data once (safe to re-run; it also migrates
   older tables to per-user rows):
   ```bash
   DATABASE_URL="postgres://..." SEED_USER_ID="user_..." npm run db:seed
   ```
4. Before deploying, check `vercel whoami` shows the right team, and that commits are
   authored by the account that's a member of it.

## Layout

```
app/page.tsx                 dashboard (server component)
app/actions.ts               create / update / delete server actions
app/api/position/route.ts    JSON: { trades, position, price, lastUpdated }
lib/position.ts              pure position math (+ tests)
lib/trades-repo.ts           storage interface → lib/repo/{json,postgres}.ts
lib/price.ts                 CoinGecko fetch, 60s cache, stale fallback
lib/auth.ts                  Clerk allowlist check
components/dashboard/        metric cards, charts, trade history
components/trade-form/       entry form (drawer on mobile, dialog on desktop)
db/schema.sql                Postgres schema
```
