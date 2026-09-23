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

## Insights (opt-in)

Off by default, and nothing about it appears on the dashboard until it's switched on
from the account menu ("Show insights"). When on, a panel lists plain facts worked out
from that user's own trades: how concentrated the holdings are, how much profit is
banked versus on paper, cost basis against the live price, fees paid, coins fully sold,
and whether the ledger has gone a month without an entry.

Each user sets their own line in Settings (account menu): a multiple between 1.1 and 20,
default 2. Once a position is worth that multiple or more of the cost still in it, the panel also works out
how much of it would have to sell at today's price to take that original cost back out,
and what would be left. It states the arithmetic and stops there: no line ever tells
anyone to buy, sell or hold — a test asserts that. The setting lives in `user_prefs` and is per user.

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
2. Restrict who can use the app with [`config/allowlist.ts`](config/allowlist.ts) and/or
   `ALLOWED_USER_IDS` — see **Who can sign in** below.
3. Set `SEED_USER_ID` to your ID so the committed seed trades show up as yours locally.

Every server action and API route calls `requireOwner()` (`lib/auth.ts`), which returns
the signed-in user's ID; all storage calls are scoped by it.

## Who can sign in

The app is invite-only by user ID. Two sources, and **both** are honoured — the ID needs
to be in either one, not both:

| Source | Use it for |
|---|---|
| `config/allowlist.ts` | the real list. Committed, reviewable, deploys on push. |
| `ALLOWED_USER_IDS` env var (comma-separated) | local dev, and patching production in a hurry. |

If both are empty, anyone who signs in gets in with their own empty ledger — the local-dev
default, never what production should run on. Someone signed in but not listed sees
**You're almost in**, which shows them their own user ID to send you.

### Adding a user

1. Get their Clerk **production** user ID. It's on the **You're almost in** screen they see
   after signing in, or from the CLI:

   ```bash
   clerk users list --instance prod --mode agent
   ```

2. Add it to `ALLOWLIST` in [`config/allowlist.ts`](config/allowlist.ts), with a comment
   saying who it is and the date:

   ```ts
   "user_3Jim…", // ki***@gmail.com, 2026-09-23
   ```

3. Commit and push to `main`. That's it — the push deploys, and they're in on the next load.

   ```bash
   git commit -am "Allow <who>" && git push
   ```

Removing someone is the same edit in reverse. Their trades stay in the database under their
user ID; nothing is deleted.

**Working locally:** the allowlist holds *production* IDs, so the dev Clerk instance issues
you a different one. Sign in locally once, copy the ID off the **You're almost in** screen
into `ALLOWED_USER_IDS` in `.env.local`, and you're in without editing the committed list.

**Why not the env var alone:** `ALLOWED_USER_IDS` is stored sensitive on Vercel, so nothing
can read it back — `vercel env pull` prints `[SENSITIVE]`. Every change meant rebuilding the
whole list from Clerk and hoping it was complete. Note that `vercel env ls`'s age column
shows when a var was *created*, not last changed; `vercel env ls production --json` has the
real `updatedAt`.

## Deploying to Vercel

Vercel's filesystem is read-only, so production uses Postgres:

1. Add **Neon** from the Vercel Marketplace; it sets `DATABASE_URL`.
2. Set `TRADES_STORE=postgres` and the Clerk keys in the project's env vars. Access comes from
   `config/allowlist.ts`; `ALLOWED_USER_IDS` is only needed to add someone without a deploy.
3. Create the table and load the seed data once (safe to re-run; it also migrates
   older tables to per-user rows):
   ```bash
   DATABASE_URL="postgres://..." SEED_USER_ID="user_..." npm run db:seed
   ```
4. After a schema change, apply it (create-only, no data touched):
   ```bash
   DATABASE_URL="postgres://..." npm run db:migrate
   ```
5. Before deploying, check `vercel whoami` shows the right team, and that commits are
   authored by the account that's a member of it.

## Layout

```
app/page.tsx                 dashboard (server component)
app/actions.ts               create / update / delete server actions
app/api/position/route.ts    JSON: { trades, position, price, lastUpdated }
config/allowlist.ts          who may sign in (committed; see "Who can sign in")
lib/position.ts              pure position math (+ tests)
lib/insights.ts              opt-in observations about your own ledger (+ tests)
lib/prefs.ts                 per-user settings shape + bounds (client-safe)
lib/prefs-repo.ts            settings storage, same store as trades
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
