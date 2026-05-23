// Server-side Wikivoyage import pipeline.
//
// Wikivoyage isn't geo-indexed (articles live at /wiki/<Destination>), but
// Wikidata IS — so we use Wikidata SPARQL to find which Wikivoyage articles
// cover places inside the bbox, fetch each article's wikitext, parse the
// {{see|do|eat|drink|sleep|buy}} listing templates, and filter each
// listing to the requested bbox via its lat/long params.
//
// Part of the OSM/Wikidata/Wikivoyage import test feature; remove together
// with src/lib/osmImport.ts.

export const runtime = "edge";

type Body = {
  bbox?: { south?: unknown; west?: unknown; north?: unknown; east?: unknown };
};

type WikivoyageBinding = {
  item?: { value: string };
  itemLabel?: { value: string };
  article?: { value: string };
};

type Listing = {
  type: string;
  title: string;
  lat: number;
  lng: number;
  content?: string;
  url?: string;
  phone?: string;
  email?: string;
  address?: string;
  article: string;
};

const USER_AGENT = "TravPad/0.1 (https://travpad.vercel.app)";
const MAX_ARTICLES = 8;
const MAX_LISTINGS_PER_CALL = 200;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
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
    return json({ error: "invalid bbox" }, 400);
  }

  // 1. Ask Wikidata which Wikivoyage articles cover places inside the bbox.
  const articles = await findArticles({ south, west, north, east });
  if (articles.length === 0) {
    return json({ listings: [], articles: [] });
  }

  // 2. Fetch wikitext for the first N articles in parallel.
  const fetched = await Promise.all(
    articles.slice(0, MAX_ARTICLES).map(async (a) => ({
      title: a.title,
      text: await fetchWikitext(a.title),
    }))
  );

  // 3. Parse + filter to bbox.
  const listings: Listing[] = [];
  for (const a of fetched) {
    if (!a.text) continue;
    for (const l of parseListings(a.text, a.title)) {
      if (
        l.lat >= south &&
        l.lat <= north &&
        l.lng >= west &&
        l.lng <= east
      ) {
        listings.push(l);
        if (listings.length >= MAX_LISTINGS_PER_CALL) break;
      }
    }
    if (listings.length >= MAX_LISTINGS_PER_CALL) break;
  }

  return json({ listings, articles: articles.map((a) => a.title) });
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function findArticles(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<{ title: string }[]> {
  const sparql = `
SELECT ?item ?itemLabel ?article WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${bbox.west} ${bbox.south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${bbox.east} ${bbox.north})"^^geo:wktLiteral .
  }
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikivoyage.org/> .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 30`;
  const url =
    "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparql);
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      results?: { bindings?: WikivoyageBinding[] };
    };
    const out: { title: string }[] = [];
    const seen = new Set<string>();
    for (const row of d.results?.bindings ?? []) {
      const articleUrl = row.article?.value;
      if (!articleUrl) continue;
      const m = articleUrl.match(
        /https?:\/\/en\.wikivoyage\.org\/wiki\/(.+)$/
      );
      if (!m) continue;
      const title = decodeURIComponent(m[1]);
      if (seen.has(title)) continue;
      seen.add(title);
      out.push({ title });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchWikitext(title: string): Promise<string | null> {
  const url =
    "https://en.wikivoyage.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=" +
    encodeURIComponent(title);
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!r.ok) return null;
    const d = (await r.json()) as { parse?: { wikitext?: string } };
    return d.parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

// Pull {{see|do|eat|drink|sleep|buy}} templates out of wikitext while
// respecting nested {{...}} (templates can contain other templates in
// `content=`, e.g. links and refs).
function parseListings(wikitext: string, article: string): Listing[] {
  const wanted = new Set(["see", "do", "eat", "drink", "sleep", "buy", "listing"]);
  const out: Listing[] = [];
  let i = 0;
  while (i < wikitext.length) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < wikitext.length && depth > 0) {
        if (wikitext[j] === "{" && wikitext[j + 1] === "{") {
          depth++;
          j += 2;
        } else if (wikitext[j] === "}" && wikitext[j + 1] === "}") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      const inner = wikitext.slice(i + 2, j - 2);
      const firstPipe = inner.indexOf("|");
      const tName = (firstPipe === -1 ? inner : inner.slice(0, firstPipe))
        .trim()
        .toLowerCase();
      if (wanted.has(tName)) {
        const body = firstPipe === -1 ? "" : inner.slice(firstPipe + 1);
        const params = parseParams(body);
        const type = (params.type || tName).toLowerCase();
        const title = params.name || params.alt;
        const lat = parseFloat(params.lat ?? "");
        const lng = parseFloat(params.long ?? params.lon ?? "");
        if (title && Number.isFinite(lat) && Number.isFinite(lng)) {
          out.push({
            type,
            title: stripMarkup(title),
            lat,
            lng,
            content: params.content
              ? stripMarkup(params.content)
              : undefined,
            url: params.url || params.website || undefined,
            phone: params.phone || undefined,
            email: params.email || undefined,
            address: params.address
              ? stripMarkup(params.address)
              : undefined,
            article,
          });
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

// Split a template body by `|` while respecting nested {{...}} and [[...]].
function parseParams(body: string): Record<string, string> {
  const parts: string[] = [];
  let depthCurly = 0;
  let depthSquare = 0;
  let current = "";
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    const nx = body[k + 1];
    if (c === "{" && nx === "{") {
      depthCurly++;
      current += "{{";
      k++;
      continue;
    }
    if (c === "}" && nx === "}") {
      depthCurly--;
      current += "}}";
      k++;
      continue;
    }
    if (c === "[" && nx === "[") {
      depthSquare++;
      current += "[[";
      k++;
      continue;
    }
    if (c === "]" && nx === "]") {
      depthSquare--;
      current += "]]";
      k++;
      continue;
    }
    if (c === "|" && depthCurly === 0 && depthSquare === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  parts.push(current);

  const params: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim();
    if (key) params[key] = val;
  }
  return params;
}

// Quick-and-dirty wikitext → plain text. Strips links, refs, comments and
// bold/italic markers; good enough for descriptions shown in TravPad.
function stripMarkup(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^/]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[(?:https?:[^\s\]]+)\s+([^\]]+)\]/g, "$1")
    .replace(/'''([^']+)'''/g, "$1")
    .replace(/''([^']+)''/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
