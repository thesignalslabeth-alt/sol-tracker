/**
 * Who can sign in to Trade Tracker.
 *
 * These are Clerk **production** user IDs (the crypto.synthwork.app instance). Editing
 * this file and pushing to main is the whole process for adding or removing someone —
 * the push deploys itself. No dashboard, no CLI, nothing to rebuild from memory.
 *
 * The list is combined with the ALLOWED_USER_IDS env var, so local dev can add its own
 * dev-instance ID in .env.local without touching this file, and production can still be
 * patched from Vercel in a hurry. Neither one overrides the other; both are allowed.
 *
 * If this list AND the env var are both empty, any signed-in user is let in (see
 * lib/auth.ts) — that is the local-dev default, not something production should rely on.
 *
 * A new user gets their ID from the "You're almost in" screen at /. Add it below with a
 * comment saying who they are, so the list stays readable a year from now.
 */
export const ALLOWLIST: readonly string[] = [
  "user_3Jgn6GGAFDSSQWqcHWYAN7swOUn", // owner — benny@synthwork.app, 2026-09-22
  "user_3Jgn7qpXiV9UTk0YvqzH815PIvP", // li***@gmail.com, 2026-09-22
  "user_3Jgn7yfc3bq0SwV4tvCiSksnLHS", // tl***@gmail.com, 2026-09-22
  "user_3JimkU1FC5JukeZ223l3lNM8AIQ", // ki***@gmail.com, 2026-09-23
  "user_3JjkZNDCm6lOBO3FqpAZJebKLd4", // eb***@gmail.com, 2026-09-23
];
