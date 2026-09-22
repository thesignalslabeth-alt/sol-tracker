const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const sgd = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", currencyDisplay: "code", maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

export const fmtUsd = (n: number) => usd.format(n);
export const fmtUsdCompact = (n: number) => (Math.abs(n) >= 10_000 ? usdCompact.format(n) : usd.format(n));
export const fmtSgd = (n: number) => sgd.format(n);
export const fmtQtyNum = (n: number) => qty.format(n);
export const fmtQty = (n: number, asset: string) => `${qty.format(n)} ${asset}`;

/** Price per unit: more decimals for sub-dollar assets. */
export function fmtPrice(n: number) {
  if (n >= 1) return usd.format(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(n);
}

/** Always signed, so gains/losses never rely on color alone. */
export const fmtSignedUsd = (n: number) => `${n >= 0 ? "+" : "−"}${usd.format(Math.abs(n))}`;
export const fmtSignedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;

export const plClass = (n: number) => (n >= 0 ? "text-gain" : "text-loss");

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date in Singapore, YYYY-MM-DD. */
export function todaySg() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}
