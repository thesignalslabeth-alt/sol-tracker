// Currencies a trade can be entered in. Everything is converted to USD for the math;
// the original amount and rate are kept for display. Rates come from CoinGecko
// (USDT priced in each currency), so every code here must be a CoinGecko vs_currency.
export const CURRENCIES = ["USD", "SGD", "MYR", "IDR", "THB", "PHP", "VND", "HKD", "JPY", "KRW", "CNY", "TWD", "INR"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: "US dollar",
  SGD: "Singapore dollar",
  MYR: "Malaysian ringgit",
  IDR: "Indonesian rupiah",
  THB: "Thai baht",
  PHP: "Philippine peso",
  VND: "Vietnamese dong",
  HKD: "Hong Kong dollar",
  JPY: "Japanese yen",
  KRW: "South Korean won",
  CNY: "Chinese yuan",
  TWD: "New Taiwan dollar",
  INR: "Indian rupee",
};

export const isCurrency = (c: string): c is Currency => (CURRENCIES as readonly string[]).includes(c);
