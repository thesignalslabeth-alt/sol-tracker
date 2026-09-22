# Trade Tracker

Crypto spot-position tracker: moving-average cost basis, realized and unrealized P/L,
portfolio value and break-even price per asset, plus a portfolio overview. Any coin
with a USDT pair on Binance can be tracked; live prices come from Binance's public API.
Mobile-first; trades are logged in the app or imported from CSV.

Stack: Next.js 16 (App Router) · Tailwind v4 + shadcn/ui · Recharts · Clerk · Neon Postgres.
No Vite anywhere; tests use Node's built-in runner.

## Run locally

```bash
npm install
cp .env.example .env.local   # leave the Clerk keys blank to start
npm run dev
```

Open http://localhost:3000. With `TRADES_STORE=json`, trades are read from and written
to `data/trades.json`.

`npm run dev` listens on 127.0.0.1 only, so nothing else on your network can reach it.
To test on your phone over Wi-Fi, use `npm run dev:lan`, and only with Clerk keys set.

Without Clerk keys the app refuses to serve. For UI work without signing in, set
`DEV_AUTH_BYPASS=1` as well (and blank the Clerk keys): auth is then off and a banner
shows. This only works in `next dev`, never in a production build.

## Tests

```bash
npm test
```

`lib/position.test.ts` checks the seed data reproduces the known figures (avg cost
$72.47, realized P/L $1,628.63, remaining basis $2,898.90, break-even $31.76) plus
re-averaging, oversell and back-dated-sell cases.

## Adding a trade

Tap **Add trade** (bottom of the screen on mobile, top right on desktop):

1. Pick **Buy** or **Sell**, the asset (search by symbol or name), the date and the currency:
   USD, SGD, MYR, IDR, THB, PHP, VND, HKD, JPY, KRW, CNY, TWD or INR.
2. Enter the SOL amount and either the **total** or the **price per SOL**, net of fees.
   For sells, **Max** fills the most you can sell on that date.
3. For non-USD trades, the exchange rate (e.g. 1 USD = 4.08 MYR) is pre-filled from the live
   rate; change it to match your actual fill. Everything is converted to USD for the math,
   and the original amount is kept. Example: sold 33 SOL for SGD 4,270 at 1 USD = 1.2710 SGD → $3,359.56.
4. Check the preview ("Avg cost $72.47 → $77.98", or "Realizes +$660.66"), then save.

Each signed-in user has their own ledger: a new user starts empty and can never see
anyone else's trades. Every add, edit and delete re-checks the whole ledger, so a sell can never end up larger
than what you held at that date.

## Importing and exporting CSV

Tap the upload icon in the header:

- **Binance:** Orders → Spot Order → Trade History → Export. Pairs quoted in a USD
  stablecoin (USDT, USDC, FDUSD…) are imported; others (e.g. ETH/BTC) are listed as
  errors and skipped. Fees paid in the traded coin or the stablecoin are applied;
  fees paid in BNB are flagged but not included in cost basis.
- **Template:** `date,asset,side,quantity,total,currency,fx_usd_per_quote,total_usd,fee,note`
  (download it from the import sheet). `total` and `fee` are in `currency`;
  `fx_usd_per_quote` is USD per 1 unit of it (older files with `fx_usd_per_sgd` still import).

You see a preview of every row before anything is saved. Imports are all-or-nothing
(rejected if they'd oversell) and re-importing the same file skips rows already present.
The download icon exports all your trades in the template format.

**How cost basis works:** moving average cost. A buy re-averages your cost; a sell
removes units at the current average and leaves the average unchanged. Each asset has its own average.

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
lib/price.ts                 Binance prices (60s cache) + fiat rates, stale fallback
lib/currencies.ts            supported trade currencies
lib/csv.ts                   CSV parsing (template + Binance) and export (+ tests)
lib/auth.ts                  Clerk allowlist check
components/dashboard/        metric cards, charts, trade history
components/trade-form/       entry form (drawer on mobile, dialog on desktop)
components/import/           CSV import sheet with row-by-row preview
db/schema.sql                Postgres schema
```
