import "server-only";
import { auth } from "@clerk/nextjs/server";
import { allowedUserIds, authBypassed, clerkConfigured } from "./auth-config";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type Viewer =
  | { status: "owner"; userId: string }
  | { status: "bypassed"; userId: string }
  | { status: "signed-out" }
  | { status: "forbidden"; userId: string }
  | { status: "misconfigured" };

export async function getViewer(): Promise<Viewer> {
  if (!clerkConfigured) {
    // Local dev without Clerk: act as the seed user so data/trades.json shows up.
    return authBypassed
      ? { status: "bypassed", userId: process.env.SEED_USER_ID ?? "local-dev" }
      : { status: "misconfigured" };
  }
  const { userId } = await auth();
  if (!userId) return { status: "signed-out" };
  // An empty allowlist lets any signed-in user in; each only ever sees their own trades.
  const allowed = allowedUserIds();
  return allowed.length === 0 || allowed.includes(userId)
    ? { status: "owner", userId }
    : { status: "forbidden", userId };
}

/**
 * Call at the top of every server action and route handler; returns the user ID to
 * scope all data access by. The proxy is not a sufficient check on its own
 * (see CVE-2025-29927).
 */
export async function requireOwner(): Promise<string> {
  const v = await getViewer();
  if (v.status === "owner" || v.status === "bypassed") return v.userId;
  if (v.status === "signed-out") throw new AuthError("Not signed in", 401);
  if (v.status === "forbidden") throw new AuthError("Not authorized", 403);
  throw new AuthError("Authentication is not configured", 503);
}
