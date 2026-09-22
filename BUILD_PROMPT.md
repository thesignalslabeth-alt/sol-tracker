# AI Build Prompt — SOL Trade Tracker Dashboard

Paste everything under **PROMPT** into Claude Code (run it from this folder).

---

## PROMPT

Build a personal Solana (SOL) trade tracking dashboard. I'm a self-taught developer comfortable with Next.js, React, TypeScript and Python, and I deploy to Vercel. Build a working MVP to this spec.

### Goal
A **mobile-first**, single-user web app that tracks my SOL spot position (average cost basis, realized P/L, unrealized P/L and total portfolio value) using a live SOL price. I log new buys and sells from my phone in the app itself. Access is protected by Clerk.

### Tech stack
- Latest stable Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (`Card`, `Table`, `Badge`, `Button`, `Input`, `Select`, `Tabs`, `Dialog`, `Drawer`, `AlertDialog`, `Sonner`)
- Recharts for charts
- Auth: Clerk (`@clerk/nextjs`)
- Forms: `react-hook-form` + `zod`. The same zod schema validates on the client and in the server action.
- Storage: behind a repository interface (`lib/trades-repo.ts`) with two implementations, chosen by `TRADES_STORE`:
  - `json`: reads and writes `data/trades.json`. For local dev only.
  - `postgres`: Neon Postgres (`@neondatabase/serverless`, raw SQL, no ORM), provisioned through the Vercel Marketplace. Used in production, because Vercel's filesystem is read-only and the in-app entry form has to persist.
- Tests: Node's built-in test runner (`node --import tsx --test`). **No Vite or Vitest**, and nothing that pulls Vite in transitively. Run `npm ls vite` after installing and confirm it's empty.
- Deploy target: Vercel

### Price source
Use CoinGecko's simple price endpoint (`/api/v3/simple/price?ids=solana&vs_currencies=usd,sgd`). It's free, needs no key, and returns SGD too. Put the current free-tier rate limit in a comment, taken from their docs. Fetch it server-side only, cached for 60 s (`fetch(url, { next: { revalidate: 60 } })`). If the fetch fails, return the last good price with `stale: true` rather than a 500 error, and show a "price stale" badge in the UI.

### Data model
Store only **raw facts**. Every derived number (cost basis of a sale, realized P/L, averages) is computed, never stored.

```ts
type Trade = {
  id: string;                      // uuid
  date: string;                    // ISO 8601 date, e.g. "2026-08-27"
  side: "buy" | "sell";
  sol_amount: number;              // > 0
  total_usd: number;               // cost for buys, proceeds for sells, net of fees
  fee_usd: number;                 // 0 if unknown or already netted out
  quote_currency: "USD" | "SGD";
  quote_amount: number | null;     // amount in SGD if the trade was in SGD
  fx_usd_per_quote: number | null; // rate used to convert SGD to USD
  note: string | null;
  created_at: string;              // ISO timestamp; breaks ties between same-day trades
};
```
In Postgres, use `numeric(20,8)` for amounts and parse them to numbers in the repo layer. Put the schema in `db/schema.sql`, and add `npm run db:seed` to load `data/trades.json` into Postgres.

### Seed data
<!-- If you have the 21 individual buys, paste them here and delete the aggregate buy. -->
I don't have the 21 individual buys in this prompt. **Don't invent them.** Seed a single aggregate buy with `note: "Aggregate of 21 buys, Jun–Aug 2026"`:

| date | side | SOL | total_usd | quote |
|---|---|---|---|---|
| 2026-08-01 | buy | 97 | 7029.83 | USD |
| 2026-08-27 | sell | 33 | 3359.56 | SGD 4270.00 @ 0.786782 USD/SGD |
| 2026-09-22 | sell | 24 | 2400.00 | USD |

### Core logic: `lib/position.ts` (pure functions, no I/O)
Use the **moving average cost** method, and process trades ordered by `date`, then `created_at`:
- On a buy: `costBasis += total_usd; solHeld += sol_amount; avgCost = costBasis / solHeld`
- On a sell: `soldBasis = sol_amount × avgCost; realizedPL += total_usd − soldBasis; costBasis −= soldBasis; solHeld −= sol_amount`. `avgCost` doesn't change.
- Throw a typed `OversellError` (with the date and shortfall) if a sell exceeds `solHeld` at that point in time.

Note: this is *not* "the weighted average of all buys ever". The two are the same today, but they diverge once I buy again after a sale.

`calculatePosition(trades, currentPrice)` returns:
- `avgCostBasis`, `solHeld`, `remainingCostBasis`
- `totalCapitalDeployed`: sum of buy `total_usd`
- `totalRealizedCash`: sum of sell `total_usd`
- `realizedPL`, plus a per-sale breakdown `{ id, soldBasis, realizedPL, realizedPct }`
- `unrealizedValue = solHeld × currentPrice`
- `unrealizedPL = unrealizedValue − remainingCostBasis`
- `totalPortfolioValue = totalRealizedCash + unrealizedValue`
- `totalPL = realizedPL + unrealizedPL`. This must equal `totalPortfolioValue − totalCapitalDeployed`; assert it in tests.
- `totalProfitPct = totalPL / totalCapitalDeployed × 100`
- `breakEvenPrice = max(0, (totalCapitalDeployed − totalRealizedCash) / solHeld)`: the price at which the whole trade is flat

Also export `previewTrade(trades, draft, currentPrice)`, which returns the position before and after adding `draft`. The entry form uses it for a live preview.

### Tests (`lib/position.test.ts`)
With the seed data, results must match these to within $0.01:
- avgCostBasis 72.47 (72.4725), solHeld 40
- Sale 1: soldBasis 2391.59, realizedPL 967.97 (+40.47%)
- Sale 2: soldBasis 1739.34, realizedPL 660.66 (+37.98%)
- realizedPL 1628.63, totalRealizedCash 5759.56, remainingCostBasis 2898.90, breakEvenPrice 31.76

Also test: buying after a sale re-averages correctly (40 @ 72.4725 held, then buy 10 for $1,000 → avg 77.98); a sell larger than holdings throws `OversellError`; a back-dated sell that oversells at its own date throws even if current holdings would cover it; deleting a buy that a later sell depends on is rejected; trade order in storage doesn't matter; the zod schema rejects zero, negative and non-numeric amounts.

### Authentication (Clerk)
- Wrap the app in `<ClerkProvider>`. Protect everything except `/sign-in` with `clerkMiddleware()` (in `middleware.ts`, or `proxy.ts` if the installed Next.js version uses that name).
- Single user: allow access only if the signed-in user's ID is in `ALLOWED_USER_IDS` (comma-separated). Everyone else gets a "not authorized" page. I'll also turn off sign-ups in the Clerk dashboard.
- **Middleware isn't the only check.** Every server action and route handler calls `auth()` and checks the allowlist again, via a shared `requireOwner()` helper, before touching the repo.
- Put a `<UserButton />` in the header.
- If the Clerk env vars are missing in local dev, fail with a clear error message rather than silently running unprotected.

### Entering trades (UI)
- An **"Add trade"** button: a sticky full-width button at the bottom of the screen on mobile, and a header button on desktop. It opens a bottom-sheet `Drawer` on mobile and a `Dialog` on `md` and up (a responsive dialog pattern).
- Form fields:
  - Side: Buy/Sell segmented `Tabs`, with green for buy and red for sell.
  - Date, defaulting to today.
  - SOL amount.
  - Currency: USD or SGD.
  - Entry mode: toggle between **total** and **price per SOL**. The other value is calculated and shown.
  - If SGD: SGD amount plus FX rate, pre-filled from CoinGecko (`usd / sgd`) and editable.
  - Fee (optional).
  - Note (optional).
- Numeric inputs use `inputMode="decimal"`, and there's a **"Max"** shortcut for sells that fills in current holdings.
- **Live preview** before saving (from `previewTrade`):
  - Buy: "Avg cost $72.47 → $77.98".
  - Sell: "Realizes +$660.66 (+37.98%) at avg cost $72.47. Avg cost unchanged."
  - An oversell is shown inline and disables Save.
- Save goes through a server action: zod validation → `requireOwner()` → load all trades → run `calculatePosition` on the ledger with the new trade added (rejecting an `OversellError`) → write → `revalidatePath`. Show a toast on success and a readable error on failure.
- **Edit and delete** from the trade list: edit reuses the same form, and delete asks for confirmation in an `AlertDialog`. Both re-validate the whole ledger, so they can't leave a later sell oversold.

### Dashboard (`app/page.tsx`)
**Mobile-first**: write the base styles for a 375 px screen, then add `sm:`/`md:`/`lg:` enhancements. No horizontal scrolling at any width.
1. **Metric cards:**
   - Cards: Avg Cost Basis, Current Price (with % vs avg cost), Total Portfolio Value, Total P/L ($ and %), Realized P/L, Unrealized P/L, Break-even Price.
   - Layout: 2 columns on mobile, 3 at `md`, 4 at `lg`, with Current Price and Total P/L first.
   - Use tabular numbers, and shorten large values on small screens (`$7.0k`).
2. Pie chart of SOL: one slice per sale, plus Remaining.
3. **Waterfall chart that adds up:** Capital Deployed → + Realized P/L → + Unrealized P/L → Total Portfolio Value.
   - Charts use `ResponsiveContainer` with a fixed height (~220 px on mobile, taller on desktop), stack in one column on mobile, and sit side by side at `lg`.
   - Legends go below the chart on mobile.
   - Tooltips work on tap.
4. **Trade history:**
   - A card list on mobile (one card per trade, showing side badge, date, SOL, price/SOL, total, and realized P/L for sells) and a sortable `Table` at `md` and up.
   - Newest first by default.
   - Each row has edit and delete actions.
5. Auto-refresh the price every 60 s, show when it was last updated, and add pull-to-refresh-friendly spacing.

General UI rules:
- Tap targets are at least 44 px.
- Respect safe-area insets (`env(safe-area-inset-bottom)`) for the sticky button.
- Profits green, losses red, and never color alone: always a +/− sign.
- Supports dark mode.
- Add a web app manifest and icons so I can add it to my phone's home screen.

Keep components under `components/dashboard/` and `components/trade-form/`.

### Constraints
- Single user only. No multi-user data model.
- Never store wallet addresses, private keys or seed phrases anywhere in the project.
- Add `.env.example` containing:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=`
  - `CLERK_SECRET_KEY=`
  - `ALLOWED_USER_IDS=`
  - `TRADES_STORE=json`
  - `DATABASE_URL=`
  - `COINGECKO_API_KEY=` (optional; sent as the demo-key header if set)

  Only the Clerk publishable key gets the `NEXT_PUBLIC_` prefix.
- Add a short `README.md` covering:
  - running locally (JSON store)
  - setting up Clerk and finding my user ID
  - provisioning Neon on Vercel and running `db:seed`
  - running the tests
  - adding a trade through the UI

### Deliverable
Create the project in this folder so it runs with `npm install && npm run dev`. Make sure `npm test`, `npm run lint` and `npm run build` pass, and `npm ls vite` is empty. Then show me the dashboard at a 375 px mobile viewport and at desktop width.

---

## Notes for you (not part of the prompt)
- Paste the 21 real buys into the seed section if you have them. The aggregate total works for the math, but the history table will show one row.
- Create the Clerk app and Neon database fresh from their dashboards, and don't reuse keys from before the wipe.
- Before deploying: `vercel whoami` should show the `synthwork` team, and commits should be authored as `benny.hermitclaw@gmail.com`.
- Under average cost, a new buy moves your avg cost basis and a sell doesn't. Each sell's realized P/L is locked in at the average cost on the day of the sale.
