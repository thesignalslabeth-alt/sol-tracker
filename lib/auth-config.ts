// Shared by proxy.ts (edge-safe: no server-only imports) and the app.

import { ALLOWLIST } from "../config/allowlist";

export const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

/**
 * Auth-off mode for local UI work. All three must hold: no Clerk keys, not a
 * production build, and an explicit DEV_AUTH_BYPASS=1. Missing keys alone never
 * open the app. Pair it with a dev server bound to 127.0.0.1 so nothing else on the
 * network can reach it.
 */
export const authBypassed =
  !clerkConfigured && process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "1";

/**
 * The committed list in config/allowlist.ts plus anything in ALLOWED_USER_IDS. Both are
 * honoured, so editing the file is the normal way to add someone and the env var stays
 * available for local dev and emergencies. Deduped, because a repeated ID must not change
 * the "empty means everyone" rule in lib/auth.ts.
 */
export function allowedUserIds(): string[] {
  const fromEnv = (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...ALLOWLIST, ...fromEnv])];
}
