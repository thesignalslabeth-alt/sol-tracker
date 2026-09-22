import "server-only";

import { CURRENCIES, type Currency } from "./currencies";

export type Prices = {
  /** USD price per base asset (from its Binance USDT pair; USDT treated as USD). */
  usd: Record<string, number>;
  /** USD per 1 unit of each supported currency (USD itself is always 1). */
  usdPer: Partial<Record<Currency, number>>;
  stale: boolean;
  fetchedAt: string | null;
};

// Binance public market data: free, no key. data-api.binance.vision is Binance's
// market-data-only host; api.binance.com is the fallback (it refuses US IPs with 451,
// and Vercel functions run in the US by default). All tickers in one call (~150 KB),
// cached 60s, so at most ~1 request/min per server instance — far below the limits.
const BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];

// Binance has no spot pairs in most Asian currencies, so fiat rates come from
// CoinGecko's public API: USDT priced in each currency (keyless, rate-limited —
// hourly caching keeps us well under it). USDT is treated as USD throughout.
const FIAT = CURRENCIES.filter((c) => c !== "USD");
const FX_URL = `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${FIAT.join(",").toLowerCase()}`;

// Last good values, returned with stale: true on failure. Per server instance only.
let lastUsd: Record<string, number> | null = null;
let lastFx: Partial<Record<Currency, number>> = {};
let lastFetchedAt: string | null = null;

async function fetchBinanceUsd(): Promise<Record<string, number>> {
  let lastError: unknown;
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/ticker/price`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`${host} ${res.status}`);
      const tickers = (await res.json()) as { symbol: string; price: string }[];
      const usd: Record<string, number> = {};
      for (const { symbol, price } of tickers) {
        const p = Number(price);
        // Delisted pairs report 0; skip them.
        if (symbol.endsWith("USDT") && p > 0) usd[symbol.slice(0, -4)] = p;
      }
      if (!usd.BTC) throw new Error(`${host} returned no USDT pairs`);
      return usd;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function fetchUsdPer(): Promise<Partial<Record<Currency, number>>> {
  const key = process.env.COINGECKO_API_KEY;
  const res = await fetch(FX_URL, {
    headers: key ? { "x-cg-demo-api-key": key } : undefined,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const perUsdt = ((await res.json()) as { tether?: Record<string, number> }).tether ?? {};
  const usdPer: Partial<Record<Currency, number>> = {};
  for (const c of FIAT) {
    const units = perUsdt[c.toLowerCase()];
    if (units > 0) usdPer[c] = 1 / units;
  }
  if (!usdPer.SGD) throw new Error("CoinGecko response missing tether rates");
  return usdPer;
}

export async function getPrices(): Promise<Prices> {
  const [usd, fx] = await Promise.allSettled([fetchBinanceUsd(), fetchUsdPer()]);
  let stale = false;

  if (usd.status === "fulfilled") {
    lastUsd = usd.value;
    lastFetchedAt = new Date().toISOString();
  } else {
    console.warn("Binance price fetch failed:", usd.reason instanceof Error ? usd.reason.message : usd.reason);
    stale = true;
  }
  if (fx.status === "fulfilled") lastFx = fx.value;
  else console.warn("FX fetch failed:", fx.reason instanceof Error ? fx.reason.message : fx.reason);

  return { usd: lastUsd ?? {}, usdPer: { ...lastFx, USD: 1 }, stale: stale || !lastUsd, fetchedAt: lastFetchedAt };
}
