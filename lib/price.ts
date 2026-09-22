import "server-only";

export type SolPrice = {
  usd: number | null;
  sgd: number | null;
  stale: boolean;
  fetchedAt: string | null;
};

// CoinGecko public API. Free, no key required. The keyless tier is heavily
// rate-limited (roughly 5–30 calls/min depending on load); a free "Demo" key
// raises that to ~30 calls/min and 10k calls/month — check
// https://docs.coingecko.com/reference/common-errors-rate-limit for current numbers.
// With the 60s cache below we make at most ~1 call/min per server instance.
const URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,sgd";

// Last good price, returned with stale: true if CoinGecko fails. Per-instance only.
let lastGood: SolPrice | null = null;

export async function getSolPrice(): Promise<SolPrice> {
  const key = process.env.COINGECKO_API_KEY;
  try {
    const res = await fetch(URL, {
      headers: key ? { "x-cg-demo-api-key": key } : undefined,
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const body = (await res.json()) as { solana?: { usd?: number; sgd?: number } };
    const usd = body.solana?.usd;
    if (typeof usd !== "number") throw new Error("CoinGecko response missing solana.usd");
    lastGood = { usd, sgd: body.solana?.sgd ?? null, stale: false, fetchedAt: new Date().toISOString() };
    return lastGood;
  } catch (e) {
    console.warn("SOL price fetch failed:", e instanceof Error ? e.message : e);
    return lastGood ? { ...lastGood, stale: true } : { usd: null, sgd: null, stale: true, fetchedAt: null };
  }
}
