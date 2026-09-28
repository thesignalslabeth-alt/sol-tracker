import "server-only";
import { NextResponse } from "next/server";
import { requireOwner } from "./auth";
import { InputError, toActionError } from "./ledger";

// JSON API for the mobile app (/api/v1). Signed in with a Clerk session token in
// `Authorization: Bearer …`, which clerkMiddleware verifies just like the web cookie.

/** Runs `fn` for the signed-in owner; any error becomes `{ ok: false, error }` with its status. */
export async function ownerJson(fn: (userId: string) => Promise<unknown>): Promise<NextResponse> {
  try {
    const userId = await requireOwner();
    return NextResponse.json(await fn(userId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { status, ...body } = toActionError(e);
    return NextResponse.json(body, { status });
  }
}

/** Parses a JSON body, or throws a 400-mapped error. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new InputError("Request body must be JSON.");
  }
}
