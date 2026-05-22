// Server-side proxy for the Wikidata Query Service.
//
// Mirrors /api/overpass: we fan out SPARQL queries from our own origin so
// the browser only ever talks to travpad.vercel.app, and we can set a
// proper User-Agent (Wikidata asks for one on Query Service requests).
//
// Part of the OSM/Wikidata import test feature; remove together with
// src/lib/osmImport.ts.

export const runtime = "edge";

type Body = {
  bbox?: {
    south?: unknown;
    west?: unknown;
    north?: unknown;
    east?: unknown;
  };
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const south = Number(body.bbox?.south);
  const west = Number(body.bbox?.west);
  const north = Number(body.bbox?.north);
  const east = Number(body.bbox?.east);
  if (
    !Number.isFinite(south) ||
    !Number.isFinite(west) ||
    !Number.isFinite(north) ||
    !Number.isFinite(east) ||
    south >= north ||
    west >= east
  ) {
    return new Response(JSON.stringify({ error: "invalid bbox" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find Wikidata Q-entities within the bbox that have an English Wikipedia
  // article. Coordinate, P31 (instance of) label, optional image (P18) and
  // article URL come back so the client can dedupe with OSM and pick a
  // sensible category.
  const sparql = `
SELECT ?item ?itemLabel ?coord ?image ?instanceLabel ?article WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${west} ${south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${east} ${north})"^^geo:wktLiteral .
  }
  ?item wdt:P31 ?instance .
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 200`;

  const url =
    "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparql);

  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "TravPad/0.1 (https://travpad.vercel.app)",
      },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Wikidata returned ${r.status}`, body: text }),
        { status: r.status, headers: { "Content-Type": "application/json" } }
      );
    }
    const text = await r.text();
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Wikidata fetch failed",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
