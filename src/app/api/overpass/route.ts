// Server-side proxy for the Overpass API.
//
// Mobile Safari sometimes refuses to fetch directly from overpass-api.de
// and the alternate mirrors ("Failed to fetch", CORS preflight failures,
// TLS quirks). Going through our own origin sidesteps all of that — the
// browser only talks to travpad.vercel.app, which then fans out to the
// Overpass mirrors server-side.
//
// Part of the OSM import test feature; remove together with src/lib/osmImport.ts.

export const runtime = "edge";

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const query =
    typeof body === "object" && body !== null && "query" in body
      ? (body as { query?: unknown }).query
      : undefined;
  if (typeof query !== "string" || query.length === 0 || query.length > 8000) {
    return new Response(JSON.stringify({ error: "invalid query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let lastError: unknown = null;
  for (const mirror of MIRRORS) {
    try {
      const r = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
        method: "GET",
      });
      if (r.ok) {
        const text = await r.text();
        return new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (r.status === 429 || r.status === 504 || r.status >= 500) {
        lastError = new Error(`${new URL(mirror).hostname}: ${r.status}`);
        continue;
      }
      // Non-retryable error from Overpass — surface it.
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      lastError = err;
    }
  }

  return new Response(
    JSON.stringify({
      error:
        lastError instanceof Error
          ? lastError.message
          : "all Overpass mirrors failed",
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}
