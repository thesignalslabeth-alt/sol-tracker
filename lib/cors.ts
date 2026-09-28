// CORS for the JSON API, so the Expo app's web build (a different origin) can call it.
// Native apps send no Origin header and never need this. Edge-safe: used by proxy.ts.

export const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "600",
} as const;

/** Origins listed in API_CORS_ORIGINS (comma-separated). Empty = no cross-origin access. */
export function corsOrigins(env: string | undefined = process.env.API_CORS_ORIGINS): string[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/**
 * The origin to echo back in Access-Control-Allow-Origin, or null when the request
 * isn't a cross-origin API call from an allowed origin. Only /api/ paths qualify.
 */
export function allowedCorsOrigin(pathname: string, origin: string | null, allowed: readonly string[]): string | null {
  if (!origin || !pathname.startsWith("/api/")) return null;
  return allowed.includes(origin) ? origin : null;
}
