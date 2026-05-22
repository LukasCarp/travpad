// OSM import — TEST FEATURE, easy to remove.
//
// To delete: remove this file, src/components/OsmImportButton.tsx and
// src/components/OsmImportDrawer.tsx, and revert the small additions in
// src/components/MapCanvas.tsx and src/components/TravPadHome.tsx.
//
// Queries the OpenStreetMap Overpass API for POIs in a bounding box and
// maps OSM tags to TravPad categories, subcategories, chips and contact
// info. Optionally enriches entries that link to Wikipedia/Wikidata with a
// short summary as the description.

import type { createClient } from "@/lib/supabase/client";
import { chipsFor } from "@/lib/pinTaxonomy";

export type OsmBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type CandidatePin = {
  osmId: string;
  // Wikidata Q-id when we know it (from the OSM `wikidata` tag or because
  // the pin came in via the Wikidata SPARQL fallback). Used to dedupe
  // between the two import sources.
  wikidataId?: string;
  source: "osm" | "wikidata";
  lat: number;
  lng: number;
  title: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  description: string | null;
  services: string[];
  details: { website?: string; phone?: string; email?: string };
  imageUrl?: string;
  // Captured during enrichment so we can stash it in the saved pin's
  // `details` for the eventual per-pin attribution UI.
  wikipediaTitle?: string;
  wikipediaLang?: string;
  rawTags: Record<string, string>;
};

// All Overpass calls go through our /api/overpass server proxy. Mobile
// Safari often refuses direct fetches to overpass-api.de / mirrors (CORS
// preflight or TLS quirks); going through our own origin sidesteps that.
const OVERPASS_PROXY = "/api/overpass";

// Tag filters chosen so the result maps cleanly to TravPad's taxonomy.
const NODE_FILTERS = [
  '"amenity"~"^(cafe|restaurant|bar|pub|fast_food|food_court|nightclub|atm|bureau_de_change|coworking_space|library|place_of_worship|cinema|theatre|arts_centre|marketplace)$"',
  '"tourism"~"^(hotel|hostel|apartment|chalet|camp_site|alpine_hut|wilderness_hut|museum|gallery|attraction|viewpoint|artwork)$"',
  '"historic"',
  '"natural"~"^(beach|peak|waterfall|cave_entrance)$"',
  '"leisure"~"^(park|swimming_pool|stadium|sports_centre)$"',
  '"shop"',
];

export async function fetchOsmPois(
  bounds: OsmBounds
): Promise<CandidatePin[]> {
  const { south, west, north, east } = bounds;
  const filters = NODE_FILTERS.map(
    (t) => `  node[${t}](${south},${west},${north},${east});`
  ).join("\n");
  // `out body` returns tags AND geometry (lat/lon for nodes). `out tags`
  // alone strips coordinates and the result becomes unusable for pins.
  const query = `[out:json][timeout:60];\n(\n${filters}\n);\nout body 200;`;

  console.log(
    "[osmImport] querying bbox:",
    `S=${south.toFixed(4)} W=${west.toFixed(4)} N=${north.toFixed(4)} E=${east.toFixed(4)}`
  );

  const res = await fetch(OVERPASS_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Overpass proxy ${res.status}: ${text || "no body"}`);
  }
  const data = (await res.json()) as {
    elements?: OsmElement[];
    remark?: string;
  };
  // Overpass signals timeouts / "query too large" via a 200 response with a
  // `remark` field instead of an HTTP error. Surface it as a real error.
  if (data.remark) {
    console.warn("[osmImport] Overpass remark:", data.remark);
    throw new Error(`Overpass: ${data.remark}`);
  }
  const raw = data.elements ?? [];
  const parsed = raw
    .map(parseElement)
    .filter((p): p is CandidatePin => p !== null);
  console.log(
    `[osmImport] elements=${raw.length}  parsed=${parsed.length}` +
      (raw.length > 0 && parsed.length === 0
        ? "  (every element filtered out — likely missing name or unmapped tag)"
        : "")
  );
  return parsed;
}

// Rough area of the bbox in square degrees. Used to warn when the user is
// trying to import from a vast area where Overpass will likely time out.
export function bboxAreaDeg2(b: OsmBounds): number {
  return (b.north - b.south) * (b.east - b.west);
}

type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

function parseElement(el: OsmElement): CandidatePin | null {
  const t = el.tags ?? {};
  const title = t["name:en"] || t["name:sv"] || t.name;
  if (!title || typeof el.lat !== "number" || typeof el.lon !== "number") {
    return null;
  }

  // Require a Wikipedia/Wikidata link — without one we can't produce a
  // description or an image, and we only want fully populated pins.
  if (!t.wikidata && !t.wikipedia) return null;

  const mapping = mapTags(t);
  if (!mapping) return null;

  const services = mapChips(t, mapping.category, mapping.subcategory);

  const details: { website?: string; phone?: string; email?: string } = {};
  const website = t.website || t["contact:website"] || t.url;
  if (website) details.website = website;
  const phone = t.phone || t["contact:phone"];
  if (phone) details.phone = phone;
  const email = t.email || t["contact:email"];
  if (email) details.email = email;

  return {
    osmId: `${el.type}/${el.id}`,
    wikidataId: typeof t.wikidata === "string" ? t.wikidata : undefined,
    source: "osm",
    lat: el.lat,
    lng: el.lon,
    title,
    category: mapping.category,
    subcategory: mapping.subcategory,
    // Leave short_description empty so the user can write their own; the
    // OSM description (often local-language) goes into the long description.
    short_description: null,
    description: t.description ?? null,
    services,
    details,
    rawTags: t,
  };
}

type CatPair = { category: string; subcategory: string | null };

function mapTags(t: Record<string, string>): CatPair | null {
  // Eat/Drink
  if (t.amenity === "cafe")
    return { category: "Eat/Drink", subcategory: "Café & Bakery" };
  if (t.amenity === "restaurant")
    return { category: "Eat/Drink", subcategory: "Restaurant" };
  if (t.amenity === "bar" || t.amenity === "pub")
    return { category: "Eat/Drink", subcategory: "Bars & Pubs" };
  if (t.amenity === "fast_food" || t.amenity === "food_court")
    return { category: "Eat/Drink", subcategory: "Street Food & Markets" };
  if (t.amenity === "marketplace")
    return { category: "Eat/Drink", subcategory: "Street Food & Markets" };

  // Money
  if (t.amenity === "atm")
    return { category: "Money", subcategory: "ATM / Cash Machine" };
  if (t.amenity === "bureau_de_change")
    return { category: "Money", subcategory: "Exchange & Transfer" };

  // Internet & Work
  if (t.amenity === "coworking_space")
    return { category: "Internet & Work", subcategory: "Coworking Spaces" };
  if (t.amenity === "library")
    return {
      category: "Internet & Work",
      subcategory: "Wifi Cafés & Libraries",
    };

  // Entertainment
  if (t.amenity === "nightclub")
    return { category: "Entertainment", subcategory: "Clubs & Nightlife" };
  if (
    t.amenity === "cinema" ||
    t.amenity === "theatre" ||
    t.amenity === "arts_centre"
  )
    return {
      category: "Entertainment",
      subcategory: "Live Music & Performing Arts",
    };

  // See/Do
  if (t.amenity === "place_of_worship")
    return { category: "Sights", subcategory: "Temples & Religious Sites" };
  if (t.tourism === "museum" || t.tourism === "gallery")
    return { category: "Sights", subcategory: "Arts & Museums" };
  if (t.tourism === "artwork")
    return { category: "Sights", subcategory: "Arts & Museums" };
  if (t.tourism === "attraction")
    return { category: "Sights", subcategory: "History & Monuments" };
  if (t.tourism === "viewpoint")
    return { category: "Sights", subcategory: "Nature & Viewpoints" };
  if (t.historic)
    return { category: "Sights", subcategory: "History & Monuments" };
  if (t.natural === "beach")
    return { category: "Sights", subcategory: "Beaches & Coastal" };
  if (
    t.natural === "peak" ||
    t.natural === "waterfall" ||
    t.natural === "cave_entrance"
  )
    return { category: "Sights", subcategory: "Nature & Viewpoints" };
  if (t.leisure === "park")
    return { category: "Sights", subcategory: "Nature & Viewpoints" };
  if (
    t.leisure === "swimming_pool" ||
    t.leisure === "stadium" ||
    t.leisure === "sports_centre"
  )
    return { category: "Activities", subcategory: "Adventure & Sports" };

  // Sleep
  if (t.tourism === "hotel")
    return { category: "Sleep", subcategory: "Hotel & Resort" };
  if (t.tourism === "hostel")
    return { category: "Sleep", subcategory: "Hostel & Guesthouse" };
  if (t.tourism === "apartment" || t.tourism === "chalet")
    return { category: "Sleep", subcategory: "Vacation Rental & Villa" };
  if (t.tourism === "camp_site")
    return { category: "Sleep", subcategory: "Camping & Glamping" };
  if (t.tourism === "alpine_hut" || t.tourism === "wilderness_hut")
    return { category: "Sleep", subcategory: "Mountain Huts & Refuges" };

  // Shopping (broad)
  if (t.shop) {
    let sub = "Specialty & Hobbies";
    const s = t.shop;
    if (["clothes", "shoes", "boutique"].includes(s)) sub = "Fashion & Malls";
    else if (["mall", "department_store"].includes(s)) sub = "Fashion & Malls";
    else if (
      [
        "bakery",
        "supermarket",
        "convenience",
        "butcher",
        "greengrocer",
        "deli",
        "wine",
        "alcohol",
      ].includes(s)
    )
      sub = "Groceries & Delicatessen";
    else if (["antiques", "second_hand"].includes(s))
      sub = "Vintage & Second Hand";
    else if (["art", "craft", "gift"].includes(s)) sub = "Local Craft & Design";
    return { category: "Shopping", subcategory: sub };
  }

  return null;
}

function mapChips(
  t: Record<string, string>,
  category: string,
  subcategory: string | null
): string[] {
  if (!subcategory) return [];
  const allowed = new Set(chipsFor(category, subcategory));
  const wanted: string[] = [];
  const tryAdd = (chip: string) => {
    if (allowed.has(chip)) wanted.push(chip);
  };

  if (t.outdoor_seating === "yes") {
    tryAdd("Outdoor Seating");
    tryAdd("Outdoor Patio");
  }
  if (t["diet:vegetarian"] === "yes" || t["diet:vegan"] === "yes") {
    tryAdd("Veggie/Vegan");
    tryAdd("Vegan Options");
  }
  if (t.internet_access === "wlan" || t.internet_access === "yes") {
    tryAdd("Laptop Friendly");
    tryAdd("Power Outlets");
  }
  if (t.air_conditioning === "yes") tryAdd("AC");
  if (t["payment:cash"] === "only") tryAdd("Cash Only");
  if (t["payment:cards"] === "yes" && t["payment:cash"] !== "yes")
    tryAdd("Card Only");
  if (t.dog === "yes") tryAdd("Pet Friendly");
  if (t.breakfast === "yes") tryAdd("Breakfast/Brunch");
  if (t.live_music === "yes") {
    tryAdd("Live DJ");
    tryAdd("Live Music");
  }
  if (t.opening_hours === "24/7") tryAdd("24/7 Accessible");
  if (t.fee === "no") {
    tryAdd("Free Entry Days");
    tryAdd("Free Admission");
  }
  if (t.heritage === "1" || t.heritage === "2") tryAdd("UNESCO Heritage");

  return Array.from(new Set(wanted));
}

// Wikipedia/Wikidata enrichment — fetches a short summary for the long
// description. Best-effort; returns null on any failure.
//
// Priority: Wikidata Q-id → English (enwiki) → Swedish (svwiki) → falls
// back to whatever language the OSM `wikipedia` tag points at. The
// English-first ordering keeps the app readable when used in non-English
// regions (a place in Tokyo with `wikipedia:ja:…` still gets English text
// when an English Wikipedia article exists).
export async function fetchWikiSummary(
  wikidata: string | undefined,
  wikipedia: string | undefined
): Promise<{
  extract: string;
  lang: string;
  title: string;
  thumbnailUrl?: string;
} | null> {
  let lang = "en";
  let title: string | null = null;

  if (wikidata) {
    try {
      const r = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
          wikidata
        )}&format=json&origin=*&props=sitelinks`
      );
      const d = await r.json();
      const sl = d?.entities?.[wikidata]?.sitelinks ?? {};
      if (sl.enwiki) {
        lang = "en";
        title = sl.enwiki.title;
      } else if (sl.svwiki) {
        lang = "sv";
        title = sl.svwiki.title;
      } else {
        // Use whatever single sitelink exists.
        const first = Object.values(sl)[0] as
          | { site: string; title: string }
          | undefined;
        if (first) {
          const site = first.site || "";
          const m = site.match(/^([a-z]+)wiki$/);
          if (m) {
            lang = m[1];
            title = first.title;
          }
        }
      }
    } catch {
      // fall through to the OSM wikipedia tag
    }
  }

  if (!title && wikipedia) {
    const idx = wikipedia.indexOf(":");
    if (idx > 0) {
      lang = wikipedia.slice(0, idx);
      title = wikipedia.slice(idx + 1);
    } else {
      title = wikipedia;
    }
  }

  if (!title) return null;

  try {
    const r = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title
      )}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const extract = typeof d?.extract === "string" ? d.extract : null;
    const thumbnailUrl =
      typeof d?.thumbnail?.source === "string"
        ? (d.thumbnail.source as string)
        : undefined;
    if (extract) return { extract, lang, title, thumbnailUrl };
  } catch {
    return null;
  }
  return null;
}

// What the current user has already pinned, organised so the OSM drawer
// can hide duplicates two ways: by `osm_id` (re-imports), or by matching
// title + nearby coordinate (legacy pins that predate osm_id storage).
export async function findUserPinKeys(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{
  osmIds: Set<string>;
  wikidataIds: Set<string>;
  coordsByTitle: Map<string, { lat: number; lng: number }[]>;
}> {
  // `pins` (the raw table) has `location geography` rather than separate
  // lat/lng columns — those are only on `pins_view`. Query the view so we
  // can match by coordinates.
  const { data, error } = await supabase
    .from("pins_view")
    .select("title, lat, lng, details, created_by")
    .eq("created_by", userId);
  if (error) {
    console.warn("[osmImport] findUserPinKeys query error:", error.message);
  }
  const osmIds = new Set<string>();
  const wikidataIds = new Set<string>();
  const coordsByTitle = new Map<string, { lat: number; lng: number }[]>();
  for (const row of (data ?? []) as {
    title: string;
    lat: number;
    lng: number;
    details: Record<string, unknown> | null;
  }[]) {
    const id = row.details?.osm_id;
    if (typeof id === "string") osmIds.add(id);
    const wd = row.details?.wikidata_id;
    if (typeof wd === "string") wikidataIds.add(wd);
    const arr = coordsByTitle.get(row.title);
    const entry = { lat: row.lat, lng: row.lng };
    if (arr) arr.push(entry);
    else coordsByTitle.set(row.title, [entry]);
  }
  console.log(
    `[osmImport] dedupe: ${osmIds.size} osm_id, ${wikidataIds.size} wikidata_id, ${coordsByTitle.size} unique titles for user`
  );
  return { osmIds, wikidataIds, coordsByTitle };
}

// Downloads a remote image (e.g. a Wikipedia thumbnail) and uploads it into
// the pin-images Storage bucket as if it were a normal user upload. Returns
// the storage path, or null on any failure.
//
// NOTE (test feature): this stores images without attribution. The
// Wikipedia images are usually CC-BY-SA which legally requires displaying
// the author and license — fine for local testing, but production use
// would need an attribution UI and DB column for credit/license per image.
export async function uploadImageFromUrl(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  imageUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;

    let ext = "jpg";
    try {
      const m = new URL(imageUrl).pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (m) ext = m[1].toLowerCase();
    } catch {
      // keep default
    }

    const path = `${userId}/${Date.now()}-osm-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("pin-images")
      .upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: false,
      });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

// MyMemory machine translation — free, no API key, ~500-char limit per
// request. Used as a best-effort fallback when only a non-English Wikipedia
// summary is available. Returns the original text on failure.
export async function translateToEnglish(
  text: string,
  sourceLang: string
): Promise<string> {
  if (sourceLang === "en" || !text) return text;

  // Split into sentence-shaped chunks that fit MyMemory's per-call limit.
  const chunks: string[] = [];
  let current = "";
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if ((`${current} ${part}`).trim().length > 480) {
      if (current) chunks.push(current);
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) chunks.push(current);

  const translated: string[] = [];
  for (const chunk of chunks) {
    try {
      const url =
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          chunk
        )}&langpair=${encodeURIComponent(sourceLang)}|en`;
      const r = await fetch(url);
      if (!r.ok) {
        translated.push(chunk);
        continue;
      }
      const d = await r.json();
      const out = d?.responseData?.translatedText;
      translated.push(
        typeof out === "string" && out.length > 0 ? out : chunk
      );
    } catch {
      translated.push(chunk);
    }
  }
  return translated.join(" ");
}

// Wikidata SPARQL fallback — fetches Q-entities inside the bbox that have
// an English Wikipedia article. Catches places that OSM doesn't tag with
// a wikidata id (statues, smaller monuments, etc.).
export async function fetchWikidataPois(
  bounds: OsmBounds
): Promise<CandidatePin[]> {
  const res = await fetch("/api/wikidata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox: bounds }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wikidata proxy ${res.status}: ${text || "no body"}`);
  }
  const data = (await res.json()) as {
    results?: { bindings?: WikidataBinding[] };
  };
  const bindings = data.results?.bindings ?? [];
  console.log(`[osmImport] wikidata returned ${bindings.length} bindings`);

  // A single Q-entity can appear multiple times (one row per instance-of
  // value). Keep the first row per Q-id.
  const byQ = new Map<string, WikidataBinding>();
  for (const row of bindings) {
    const qid = qidFromUrl(row.item?.value);
    if (!qid || byQ.has(qid)) continue;
    byQ.set(qid, row);
  }

  const out: CandidatePin[] = [];
  for (const [qid, row] of byQ) {
    const title = row.itemLabel?.value;
    const coord = parseWktPoint(row.coord?.value);
    if (!title || !coord) continue;
    const mapping = mapWikidataInstance(row.instanceLabel?.value ?? "");
    if (!mapping) continue;
    const imageFile = row.image?.value;
    const imageUrl = imageFile
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
          decodeURIComponent(imageFile.split("/").pop() ?? "")
        )}?width=640`
      : undefined;
    out.push({
      osmId: `wikidata/${qid}`,
      wikidataId: qid,
      source: "wikidata",
      lat: coord.lat,
      lng: coord.lng,
      title,
      category: mapping.category,
      subcategory: mapping.subcategory,
      short_description: null,
      description: null,
      services: [],
      details: {},
      imageUrl,
      rawTags: { wikidata: qid },
    });
  }
  return out;
}

type WikidataBinding = {
  item?: { value: string };
  itemLabel?: { value: string };
  coord?: { value: string };
  image?: { value: string };
  instanceLabel?: { value: string };
};

function qidFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(Q\d+)$/);
  return m ? m[1] : null;
}

function parseWktPoint(
  wkt: string | undefined
): { lat: number; lng: number } | null {
  // "Point(18.0708 59.3252)" — longitude first in WKT.
  if (!wkt) return null;
  const m = wkt.match(/Point\(([-0-9.]+)\s+([-0-9.]+)\)/i);
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Wikidata "instance of" label → TravPad category. The label comes back in
// English thanks to the SPARQL service's `bd:serviceParam wikibase:language
// "en"`. Substring match keeps the table compact and forgiving.
function mapWikidataInstance(label: string): CatPair | null {
  const l = label.toLowerCase();
  if (!l) return null;

  if (
    l.includes("museum") ||
    l.includes("art gallery") ||
    l.includes("art museum")
  ) {
    return { category: "Sights", subcategory: "Arts & Museums" };
  }
  if (
    l.includes("church") ||
    l.includes("cathedral") ||
    l.includes("basilica") ||
    l.includes("chapel") ||
    l.includes("mosque") ||
    l.includes("synagogue") ||
    l.includes("temple") ||
    l.includes("shrine") ||
    l.includes("monastery") ||
    l.includes("abbey")
  ) {
    return { category: "Sights", subcategory: "Temples & Religious Sites" };
  }
  if (
    l.includes("castle") ||
    l.includes("fortress") ||
    l.includes("palace") ||
    l.includes("manor") ||
    l.includes("ruin") ||
    l.includes("archaeological")
  ) {
    return { category: "Sights", subcategory: "History & Monuments" };
  }
  if (
    l.includes("monument") ||
    l.includes("memorial") ||
    l.includes("statue") ||
    l.includes("sculpture") ||
    l.includes("obelisk") ||
    l.includes("tower") ||
    l.includes("bridge") ||
    l.includes("square") ||
    l.includes("piazza") ||
    l.includes("plaza") ||
    l.includes("landmark") ||
    l.includes("tourist attraction")
  ) {
    return { category: "Sights", subcategory: "History & Monuments" };
  }
  if (
    l.includes("national park") ||
    l.includes("park") ||
    l.includes("garden") ||
    l.includes("nature reserve")
  ) {
    return { category: "Sights", subcategory: "Nature & Viewpoints" };
  }
  if (
    l.includes("mountain") ||
    l.includes("peak") ||
    l.includes("hill") ||
    l.includes("waterfall") ||
    l.includes("lake") ||
    l.includes("river") ||
    l.includes("cave") ||
    l.includes("viewpoint")
  ) {
    return { category: "Sights", subcategory: "Nature & Viewpoints" };
  }
  if (l.includes("beach") || l.includes("bay") || l.includes("cove")) {
    return { category: "Sights", subcategory: "Beaches & Coastal" };
  }
  if (
    l.includes("theatre") ||
    l.includes("theater") ||
    l.includes("opera") ||
    l.includes("concert hall")
  ) {
    return {
      category: "Entertainment",
      subcategory: "Live Music & Performing Arts",
    };
  }
  if (l.includes("cinema") || l.includes("movie theatre")) {
    return {
      category: "Entertainment",
      subcategory: "Live Music & Performing Arts",
    };
  }
  if (l.includes("library")) {
    return {
      category: "Internet & Work",
      subcategory: "Wifi Cafés & Libraries",
    };
  }
  if (l.includes("hotel")) {
    return { category: "Sleep", subcategory: "Hotel & Resort" };
  }
  if (l.includes("stadium") || l.includes("arena")) {
    return { category: "Activities", subcategory: "Adventure & Sports" };
  }
  return null;
}
