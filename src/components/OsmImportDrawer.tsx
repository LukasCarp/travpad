"use client";

// OSM import drawer — TEST FEATURE, easy to remove (see src/lib/osmImport.ts).
//
// Loads POIs from OpenStreetMap for the captured bounding box, enriches a
// handful with a Wikipedia summary, and lets the user pick which to import
// as TravPad pins.

import { useEffect, useMemo, useState } from "react";
import { Loader, X } from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import {
  bboxAreaDeg2,
  fetchOsmPois,
  fetchWikidataPois,
  fetchWikidataThemedPois,
  fetchWikivoyagePois,
  fetchWikiSummary,
  findUserPinKeys,
  mergeUnesco,
  translateToEnglish,
  uploadImageFromUrl,
  type CandidatePin,
  type OsmBounds,
} from "@/lib/osmImport";
import { useAuth } from "./AuthProvider";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

type Status = "loading" | "ready" | "error" | "importing";

export default function OsmImportDrawer({
  bounds,
  onClose,
  onImported,
}: {
  bounds: OsmBounds;
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [candidates, setCandidates] = useState<CandidatePin[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(
    null
  );
  const [skippedAlreadyImported, setSkippedAlreadyImported] = useState(0);
  const [truncated, setTruncated] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus("loading");
      setError(null);
      // Guard against huge bboxes — Overpass/Wikidata will return a flood
      // of candidates (or just time out), the UI becomes unmanageable, and
      // we hammer free APIs unnecessarily. 0.5 deg² ≈ a 78 km × 78 km box.
      if (bboxAreaDeg2(bounds) > 0.5) {
        setStatus("error");
        setError(
          "This area is too large to import from — zoom in to roughly a city or smaller, then try again."
        );
        return;
      }
      try {
        // Query OSM, Wikidata (general + themed) and Wikivoyage in parallel.
        // If any of them fails the others still drive the list.
        const [osmRes, wdRes, wdtRes, wvRes] = await Promise.allSettled([
          fetchOsmPois(bounds),
          fetchWikidataPois(bounds),
          fetchWikidataThemedPois(bounds),
          fetchWikivoyagePois(bounds),
        ]);
        const osmPins = osmRes.status === "fulfilled" ? osmRes.value : [];
        const wdPins = wdRes.status === "fulfilled" ? wdRes.value : [];
        const wdtPins = wdtRes.status === "fulfilled" ? wdtRes.value : [];
        const wvPins = wvRes.status === "fulfilled" ? wvRes.value : [];
        if (osmRes.status === "rejected") {
          console.warn("[osmImport] OSM fetch failed:", osmRes.reason);
        }
        if (wdRes.status === "rejected") {
          console.warn("[osmImport] Wikidata fetch failed:", wdRes.reason);
        }
        if (wdtRes.status === "rejected") {
          console.warn(
            "[osmImport] Wikidata themed fetch failed:",
            wdtRes.reason
          );
        }
        if (wvRes.status === "rejected") {
          console.warn("[osmImport] Wikivoyage fetch failed:", wvRes.reason);
        }
        if (!alive) return;

        // Merge — OSM ↔ Wikidata dedupe by Q-id (OSM wins for contact
        // info); Wikivoyage listings have their own ids and aren't
        // automatically deduped against the others (the title + coord
        // pass in findUserPinKeys catches obvious overlaps on re-import).
        const byKey = new Map<string, CandidatePin>();
        for (const p of osmPins) {
          byKey.set(p.wikidataId ?? p.osmId, p);
        }
        for (const p of wdPins) {
          const key = p.wikidataId ?? p.osmId;
          if (!byKey.has(key)) byKey.set(key, p);
        }
        for (const p of wdtPins) {
          const key = p.wikidataId ?? p.osmId;
          if (!byKey.has(key)) byKey.set(key, p);
        }
        for (const p of wvPins) {
          byKey.set(p.osmId, p);
        }
        // UNESCO is overlay: existing pins get the heritage chip + flip
        // to source="unesco"; uncovered UNESCO sites are appended fresh.
        const list = await mergeUnesco([...byKey.values()], bounds);
        if (!alive) return;
        const unescoFlipped = list.filter((p) => p.source === "unesco").length;
        console.log(
          `[osmImport] merged: ${osmPins.length} OSM + ${wdPins.length} Wikidata + ${wdtPins.length} themed + ${wvPins.length} Wikivoyage = ${byKey.size} unique → ${list.length} after UNESCO overlay (${unescoFlipped} UNESCO-flagged)`
        );

        // Drop anything you've already pinned. Match on `osm_id` (modern
        // imports), `wikidata_id`, and also on title + nearby coordinate
        // (legacy pins without ids, ~50 m tolerance ≈ 0.0005°).
        console.log(
          `[osmImport] dedupe check — user=${user?.id ?? "(none)"}`
        );
        const keys = user
          ? await findUserPinKeys(supabase, user.id)
          : {
              osmIds: new Set<string>(),
              wikidataIds: new Set<string>(),
              coordsByTitle: new Map(),
            };
        const fresh = list.filter((p) => {
          if (keys.osmIds.has(p.osmId)) return false;
          if (p.wikidataId && keys.wikidataIds.has(p.wikidataId)) return false;
          const sameTitle = keys.coordsByTitle.get(p.title);
          if (sameTitle) {
            for (const c of sameTitle) {
              if (
                Math.abs(c.lat - p.lat) < 0.0005 &&
                Math.abs(c.lng - p.lng) < 0.0005
              ) {
                return false;
              }
            }
          }
          return true;
        });
        setSkippedAlreadyImported(list.length - fresh.length);

        // Enrich each candidate with Wikipedia + thumbnail. Only keep the
        // POIs where we got *both* — that's the whole point of this mode.
        // Cap at 50 so the UI is reviewable in one sitting and we stay
        // polite to Wikipedia/MyMemory.
        const ENRICH_CAP = 50;
        const truncatedFromFetch = fresh.length - ENRICH_CAP;
        const enriched = await Promise.all(
          fresh.slice(0, ENRICH_CAP).map(async (p): Promise<CandidatePin | null> => {
            // Wikivoyage POIs ship with their own description from the
            // listing template — no Wikipedia round-trip needed.
            if (p.source === "wikivoyage") {
              return p.description ? p : null;
            }
            const wd = p.wikidataId ?? p.rawTags?.wikidata;
            const wp = p.rawTags?.wikipedia;
            const s = await fetchWikiSummary(wd, wp);
            // Description is required; photo is optional. UNESCO sites
            // pass even without a Wikipedia article — they're worth
            // keeping for the name + image + heritage chip alone.
            if (!s?.extract) return p.source === "unesco" ? p : null;
            const text =
              s.lang === "en"
                ? s.extract
                : await translateToEnglish(s.extract, s.lang);
            return {
              ...p,
              description: text,
              // Wikipedia's thumbnail takes precedence; Wikidata P18 is
              // the fallback (already set on Wikidata-sourced candidates).
              imageUrl: s.thumbnailUrl ?? p.imageUrl,
              wikipediaTitle: s.title,
              wikipediaLang: s.lang,
            };
          })
        );
        const all = enriched.filter(
          (p): p is CandidatePin => p !== null
        );
        if (!alive) return;
        setCandidates(all);
        setSelected(new Set(all.map((p) => p.osmId)));
        setTruncated(Math.max(0, truncatedFromFetch));
        setStatus("ready");
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Couldn't load OSM data");
          setStatus("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [bounds, supabase, user]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map((p) => p.osmId)));
  }

  async function handleImport() {
    if (!user) {
      setError("Sign in to import pins.");
      return;
    }
    setStatus("importing");
    let ok = 0;
    let failed = 0;
    for (const p of candidates) {
      if (!selected.has(p.osmId)) continue;
      try {
        // If the pin has a Wikipedia thumbnail, copy it into Storage so it
        // shows up as a normal pin image. Failures are non-fatal — the pin
        // is still created without an image.
        const imagePaths: string[] = [];
        if (p.imageUrl && user) {
          const path = await uploadImageFromUrl(supabase, user.id, p.imageUrl);
          if (path) imagePaths.push(path);
        }

        // Capture where each piece of info came from so the future
        // attribution UI has what it needs (Wikipedia title/lang, source).
        const attributionDetails: Record<string, unknown> = {
          ...p.details,
          source: p.source,
          osm_id: p.osmId,
        };
        if (p.wikidataId) attributionDetails.wikidata_id = p.wikidataId;
        if (p.wikipediaTitle) {
          attributionDetails.wikipedia_title = p.wikipediaTitle;
          attributionDetails.wikipedia_lang = p.wikipediaLang;
        }
        if (p.wikivoyageArticle) {
          attributionDetails.wikivoyage_article = p.wikivoyageArticle;
          attributionDetails.wikivoyage_lang = "en";
        }
        if (p.source === "unesco") {
          attributionDetails.unesco = true;
          if (p.unescoYear) attributionDetails.unesco_year = p.unescoYear;
          if (p.unescoCountry)
            attributionDetails.unesco_country = p.unescoCountry;
        }

        const { error: rpcError } = await supabase.rpc("create_pin", {
          p_title: p.title,
          p_category: p.category,
          p_lat: p.lat,
          p_lng: p.lng,
          p_subcategory: p.subcategory,
          p_short_description: p.short_description,
          p_description: p.description,
          p_services: p.services,
          p_details: attributionDetails,
          p_image_paths: imagePaths,
          p_secret: false,
        });
        if (rpcError) {
          failed++;
          console.warn("OSM import failed for", p.title, rpcError.message);
        } else {
          ok++;
        }
      } catch (e) {
        failed++;
        console.warn("OSM import threw for", p.title, e);
      }
    }
    setDone({ ok, failed });
    setStatus("ready");
    if (ok > 0) onImported();
  }

  const direction = isMobile ? "bottom" : "right";
  const selectedCount = selected.size;
  const allSelected = selectedCount === candidates.length && candidates.length > 0;

  return (
    <Drawer.Root
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      direction={direction}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[800] bg-black/30 backdrop-blur-[1px]" />
        <Drawer.Content
          className={
            "fixed z-[900] flex flex-col bg-white shadow-2xl outline-none ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 " +
            (isMobile
              ? "inset-x-0 bottom-0 h-[90vh] rounded-t-2xl"
              : "inset-y-0 right-0 w-full max-w-lg")
          }
        >
          <Drawer.Title className="sr-only">
            Discover places in this area
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            Notable places found in the current map area from open wiki
            sources — review and import the ones you want as TravPad pins.
          </Drawer.Description>

          <div className="flex flex-none items-start justify-between border-b border-neutral-200 p-5 dark:border-neutral-800">
            <div>
              <h1 className="text-lg font-semibold">
                Discover places in this area
              </h1>
              <p className="mt-1 text-xs text-neutral-500">
                Notable spots pulled from OpenStreetMap, Wikipedia, Wikivoyage
                and UNESCO. Each comes with a short description and, when
                available, a photo. Uncheck anything you don&apos;t want, then
                import.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-none rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {status === "loading" && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader className="h-4 w-4 animate-spin" />
                Loading places + descriptions…
              </div>
            )}
            {status === "error" && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </p>
            )}
            {status !== "loading" &&
              status !== "error" &&
              candidates.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No matching places in this area.
                  {bboxAreaDeg2(bounds) > 0.25
                    ? " The visible area is large — Overpass may have timed out. Zoom in a bit and try again."
                    : " Try zooming out a touch, or pan to a more populated area."}
                </p>
              )}

            {skippedAlreadyImported > 0 && (
              <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {skippedAlreadyImported} place
                {skippedAlreadyImported === 1 ? "" : "s"} already imported and
                hidden.
              </p>
            )}

            {truncated > 0 && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Showing the first 50 — {truncated} more found in this area.
                Zoom in to see different places.
              </p>
            )}

            {candidates.length > 0 && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                  <span className="text-xs text-neutral-500">
                    {selectedCount} / {candidates.length} selected
                  </span>
                </div>

                <ul className="space-y-1">
                  {candidates.map((p) => {
                    const checked = selected.has(p.osmId);
                    return (
                      <li key={p.osmId}>
                        <label
                          className={
                            "flex cursor-pointer items-start gap-3 rounded-lg p-2.5 transition " +
                            (checked
                              ? "bg-rose-50 dark:bg-rose-950/40"
                              : "hover:bg-neutral-100 dark:hover:bg-neutral-800")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(p.osmId)}
                            className="mt-1 h-4 w-4 flex-none accent-rose-500"
                          />
                          {p.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-12 w-12 flex-none rounded object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 truncate text-sm font-medium">
                                {p.title}
                              </span>
                              <span
                                className={
                                  "flex-none rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                                  (p.source === "wikidata"
                                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                                    : p.source === "wikivoyage"
                                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                                      : p.source === "unesco"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300")
                                }
                              >
                                {p.source === "wikidata"
                                  ? "Wikidata"
                                  : p.source === "wikivoyage"
                                    ? "Wikivoyage"
                                    : p.source === "unesco"
                                      ? "UNESCO"
                                      : "OSM"}
                              </span>
                            </div>
                            <div className="truncate text-xs text-neutral-500">
                              {p.category}
                              {p.subcategory ? ` · ${p.subcategory}` : ""}
                              {p.services.length > 0
                                ? ` · ${p.services.length} chips`
                                : ""}
                            </div>
                            {p.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {done && (
              <p
                className={
                  "mt-4 rounded-lg px-3 py-2 text-sm " +
                  (done.failed === 0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200")
                }
              >
                Imported {done.ok} pin{done.ok === 1 ? "" : "s"}
                {done.failed > 0 ? ` · ${done.failed} failed` : ""}.
              </p>
            )}
          </div>

          <div className="flex flex-none items-center justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={
                status !== "ready" ||
                selectedCount === 0 ||
                !user
              }
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
            >
              {status === "importing"
                ? "Importing…"
                : `Import ${selectedCount}`}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
