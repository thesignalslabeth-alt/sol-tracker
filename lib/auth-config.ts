// Shared by proxy.ts (edge-safe: no server-only imports) and the app.

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

export function allowedUserIds(): string[] {
  return (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
