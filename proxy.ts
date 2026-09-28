import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authBypassed, clerkConfigured } from "@/lib/auth-config";
import { allowedCorsOrigin, CORS_HEADERS, corsOrigins } from "@/lib/cors";

// Clerk only attaches the session here. Access is enforced where the data is read:
// app/page.tsx redirects signed-out users, and every server action / API route calls
// requireOwner(). (Clerk deprecated path-matching auth in middleware.)
// The mobile app signs in with `Authorization: Bearer <session token>`, which Clerk
// verifies here the same way as the web session cookie.
const withClerk = clerkMiddleware();
const allowedOrigins = corsOrigins();

async function handle(req: NextRequest, event: NextFetchEvent): Promise<Response | null | undefined | void> {
  if (clerkConfigured) return withClerk(req, event);
  if (authBypassed) return NextResponse.next(); // explicit local auth-off mode; the UI shows a banner
  return new NextResponse("Authentication is not configured.", { status: 503 });
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  // Cross-origin API calls from the Expo app's web build (API_CORS_ORIGINS only).
  const origin = allowedCorsOrigin(req.nextUrl.pathname, req.headers.get("origin"), allowedOrigins);
  if (origin && req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin, Vary: "Origin" } });
  }

  const res = await handle(req, event);
  if (!origin) return res;
  const out = res ?? NextResponse.next();
  try {
    out.headers.set("Access-Control-Allow-Origin", origin);
    out.headers.append("Vary", "Origin");
  } catch {
    // Redirect responses have immutable headers; a browser can't follow those cross-origin anyway.
  }
  return out;
}

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
