// Shared by proxy.ts (edge-safe: no server-only imports) and the app.

export const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

/**
 * Without Clerk keys, local dev runs unprotected (with a visible banner) so the app
 * is usable before keys are set up. Production refuses to serve instead.
 */
export const authBypassed = !clerkConfigured && process.env.NODE_ENV !== "production";

export function allowedUserIds(): string[] {
  return (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
