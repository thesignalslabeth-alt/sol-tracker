import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkConfigured } from "@/lib/auth-config";

// Clerk only attaches the session here. Access is enforced where the data is read:
// app/page.tsx redirects signed-out users, and every server action / API route calls
// requireOwner(). (Clerk deprecated path-matching auth in middleware.)
const withClerk = clerkMiddleware();

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (clerkConfigured) return withClerk(req, event);
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Authentication is not configured.", { status: 503 });
  }
  return NextResponse.next(); // local dev without Clerk keys; the UI shows a banner
}

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
