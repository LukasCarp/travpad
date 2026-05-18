// Downloads a map area for offline use: the map tiles for the visible
// bounding box (current zoom ± 1) plus every pin inside that box.

import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import { savePack, savePois, saveTile, type OfflinePack } from "./db";

const PIN_COLUMNS =
  "id, title, category, subcategory, short_description, description, services, secret, details, lat, lng, created_by, created_by_name, created_at, images";

export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

// Tile servers use interchangeable subdomains (a/b/c). Strip the subdomain so
// a tile is stored and looked up under one stable key. The service worker
// applies the exact same normalization.
export function normalizeTileUrl(urlString: string): string {
  try {
    const u = new URL(urlString);
    u.hostname = u.hostname.replace(/^[a-d]\./, "");
    return u.toString();
  } catch {
    return urlString;
  }
}

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * 2 ** z
  );
}

function tileUrls(
  template: string,
  bounds: Bounds,
  minZoom: number,
  maxZoom: number
): string[] {
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const max = 2 ** z - 1;
    const x0 = Math.max(0, lngToTileX(bounds.west, z));
    const x1 = Math.min(max, lngToTileX(bounds.east, z));
    const y0 = Math.max(0, latToTileY(bounds.north, z));
    const y1 = Math.min(max, latToTileY(bounds.south, z));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(
          template
            .replace("{s}", "a")
            .replace("{z}", String(z))
            .replace("{x}", String(x))
            .replace("{y}", String(y))
        );
      }
    }
  }
  return urls;
}

async function downloadTiles(
  urls: string[],
  packId: string,
  onProgress: (done: number, total: number) => void
): Promise<number> {
  let done = 0;
  let saved = 0;
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.all(
      urls.slice(i, i + BATCH).map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            await saveTile(packId, normalizeTileUrl(url), await res.blob());
            saved++;
          }
        } catch {
          // a failed tile is skipped, not fatal
        } finally {
          done++;
          onProgress(done, urls.length);
        }
      })
    );
  }
  return saved;
}

export async function downloadPack(opts: {
  name: string;
  bounds: Bounds;
  zoom: number;
  tileTemplate: string;
  onProgress: (done: number, total: number) => void;
}): Promise<OfflinePack> {
  const { name, bounds, zoom, tileTemplate, onProgress } = opts;
  const minZoom = Math.max(1, Math.round(zoom) - 1);
  const maxZoom = Math.min(19, Math.round(zoom) + 1);

  const packId = crypto.randomUUID();
  const urls = tileUrls(tileTemplate, bounds, minZoom, maxZoom);
  const tileCount = await downloadTiles(urls, packId, onProgress);

  // Pins inside the bounding box.
  const supabase = createClient();
  const { data } = await supabase
    .from("pins_view")
    .select(PIN_COLUMNS)
    .gte("lat", bounds.south)
    .lte("lat", bounds.north)
    .gte("lng", bounds.west)
    .lte("lng", bounds.east);
  const pins = (data ?? []) as Pin[];
  await savePois(packId, pins);

  const pack: OfflinePack = {
    id: packId,
    name,
    bbox: bounds,
    minZoom,
    maxZoom,
    createdAt: new Date().toISOString(),
    tileCount,
    poiCount: pins.length,
  };
  await savePack(pack);
  return pack;
}
