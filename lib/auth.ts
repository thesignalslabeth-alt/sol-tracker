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
  | { status: "bypassed" }
  | { status: "signed-out" }
  | { status: "forbidden"; userId: string }
  | { status: "misconfigured" };

export async function getViewer(): Promise<Viewer> {
  if (!clerkConfigured) return authBypassed ? { status: "bypassed" } : { status: "misconfigured" };
  const { userId } = await auth();
  if (!userId) return { status: "signed-out" };
  return allowedUserIds().includes(userId) ? { status: "owner", userId } : { status: "forbidden", userId };
}

/**
 * Call at the top of every server action and route handler. The proxy is not a
 * sufficient check on its own (see CVE-2025-29927).
 */
export async function requireOwner(): Promise<void> {
  const v = await getViewer();
  if (v.status === "owner" || v.status === "bypassed") return;
  if (v.status === "signed-out") throw new AuthError("Not signed in", 401);
  if (v.status === "forbidden") throw new AuthError("Not authorized", 403);
  throw new AuthError("Authentication is not configured", 503);
}
