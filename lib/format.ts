const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

export const fmtUsd = (n: number) => usd.format(n);
export const fmtUsdCompact = (n: number) => (Math.abs(n) >= 10_000 ? usdCompact.format(n) : usd.format(n));
/** Amount in any trade currency, e.g. "MYR 4,080.00", "IDR 1,789,511" (Intl picks the decimals). */
export const fmtMoney = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" }).format(n);

/** Exchange rate as people quote it: units of `currency` per 1 USD. */
export const fmtRate = (usdPerUnit: number) =>
  new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(1 / usdPerUnit);
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
