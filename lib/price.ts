import "server-only";

export type Prices = {
  /** USD price per base asset (from its Binance USDT pair; USDT treated as USD). */
  usd: Record<string, number>;
  /** USD per 1 SGD, for SGD trades. */
  usdPerSgd: number | null;
  stale: boolean;
  fetchedAt: string | null;
};

// Binance public market data: free, no key. data-api.binance.vision is Binance's
// market-data-only host; api.binance.com is the fallback (it refuses US IPs with 451,
// and Vercel functions run in the US by default). All tickers in one call (~150 KB),
// cached 60s, so at most ~1 request/min per server instance — far below the limits.
const BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];

// Binance has no SGD spot pairs; USDT→SGD comes from CoinGecko's public API
// (keyless, rate-limited — hourly caching keeps us well under it).
const FX_URL = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=sgd";

// Last good values, returned with stale: true on failure. Per server instance only.
let lastUsd: Record<string, number> | null = null;
let lastFx: number | null = null;
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

async function fetchUsdPerSgd(): Promise<number> {
  const key = process.env.COINGECKO_API_KEY;
  const res = await fetch(FX_URL, {
    headers: key ? { "x-cg-demo-api-key": key } : undefined,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const sgdPerUsdt = ((await res.json()) as { tether?: { sgd?: number } }).tether?.sgd;
  if (!sgdPerUsdt) throw new Error("CoinGecko response missing tether.sgd");
  return 1 / sgdPerUsdt;
}

export async function getPrices(): Promise<Prices> {
  const [usd, fx] = await Promise.allSettled([fetchBinanceUsd(), fetchUsdPerSgd()]);
  let stale = false;

  if (usd.status === "fulfilled") {
    lastUsd = usd.value;
    lastFetchedAt = new Date().toISOString();
  } else {
    console.warn("Binance price fetch failed:", usd.reason instanceof Error ? usd.reason.message : usd.reason);
    stale = true;
  }
  if (fx.status === "fulfilled") lastFx = fx.value;
  else console.warn("SGD FX fetch failed:", fx.reason instanceof Error ? fx.reason.message : fx.reason);

  return { usd: lastUsd ?? {}, usdPerSgd: lastFx, stale: stale || !lastUsd, fetchedAt: lastFetchedAt };
}
