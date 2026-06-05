// Server-side proxy for Wikidata themed queries.
//
// Unlike /api/wikidata (which scans the bbox for *anything* with a P31 and
// an English Wikipedia article), this endpoint queries for Q-entities that
// are an instance — or subclass — of a curated list of "interesting"
// types (castle, waterfall, lighthouse, …). Catches nature/history POIs
// that the general query misses because they have no Wikipedia article.
//
// Part of the OSM/Wikidata import feature.

export const runtime = "edge";

// Q-ids to query for and the category/subcategory the matched entity should
// land in. Mapping mirrors osmImport's `mapWikidataInstance` so the same
// types land in the same OpenPin subcategory regardless of which query
// surfaced them.
const THEMES: Record<string, { category: string; subcategory: string }> = {
  Q23413: { category: "Sights", subcategory: "History & Monuments" }, // castle
  Q179700: { category: "Sights", subcategory: "History & Monuments" }, // monument
  Q34038: { category: "Sights", subcategory: "Nature & Viewpoints" }, // waterfall
  Q46169: { category: "Sights", subcategory: "Nature & Viewpoints" }, // national park
  Q35509: { category: "Sights", subcategory: "Nature & Viewpoints" }, // cave
  Q8502: { category: "Sights", subcategory: "Nature & Viewpoints" }, // mountain
  Q40080: { category: "Sights", subcategory: "Beaches & Coastal" }, // beach
  Q39715: { category: "Sights", subcategory: "Beaches & Coastal" }, // lighthouse
  Q177380: { category: "Sights", subcategory: "Beaches & Coastal" }, // hot spring
};

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

  const themeValues = Object.keys(THEMES)
    .map((q) => `wd:${q}`)
    .join(" ");

  // Search for any entity whose P31 (instance of) chains via P279* (subclass)
  // up to one of our themed types. Coord, image, the matching theme and its
  // English label come back so the client can pick a category.
  const sparql = `
SELECT ?item ?itemLabel ?coord ?image ?theme WHERE {
  VALUES ?theme { ${themeValues} }
  ?item wdt:P31/wdt:P279* ?theme .
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${west} ${south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${east} ${north})"^^geo:wktLiteral .
  }
  OPTIONAL { ?item wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300`;

  const url =
    "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparql);

  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "OpenPin/0.1 (https://openpin.app)",
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
