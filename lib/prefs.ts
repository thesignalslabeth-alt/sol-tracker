// Shared between server and client: the settings shape and its bounds.
/** Per-user settings. Everything here is off until the user turns it on. */
export type Prefs = {
  /** Show the insights panel on the dashboard. */
  insights: boolean;
  /**
   * Flag a holding once it's worth this multiple of the cost still in it.
   * The user's own line, not a recommendation.
   */
  capitalThreshold: number;
};

export const DEFAULT_PREFS: Prefs = { insights: false, capitalThreshold: 2 };

export const MIN_THRESHOLD = 1.1;
export const MAX_THRESHOLD = 20;

/** Keeps a user-supplied multiple sane; falls back to the default for junk. */
export function clampThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PREFS.capitalThreshold;
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(n * 10) / 10));
}
