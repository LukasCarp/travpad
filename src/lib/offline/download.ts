// Downloads a map area for offline use: the map tiles for the visible
// bounding box (current zoom ± 1), every pin inside that box, and a
// downsized copy of each pin photo.

import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import {
  saveImages,
  savePack,
  savePois,
  saveTile,
  type OfflinePack,
} from "./db";

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
  total: number,
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
          onProgress(done, total);
        }
      })
    );
  }
  return saved;
}

type ImageJob = { path: string; url: string; fallbackUrl: string };

async function downloadImages(
  jobs: ImageJob[],
  packId: string,
  baseDone: number,
  total: number,
  onProgress: (done: number, total: number) => void
): Promise<number> {
  let done = baseDone;
  let saved = 0;
  const BATCH = 4;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async ({ path, url, fallbackUrl }) => {
        try {
          // The transform URL needs Supabase image transformations; if that's
          // unavailable, fall back to the (already <=1 MB) original.
          let res = await fetch(url);
          if (!res.ok) res = await fetch(fallbackUrl);
          if (res.ok) {
            await saveImages(packId, [{ path, blob: await res.blob() }]);
            saved++;
          }
        } catch {
          // a failed image is skipped, not fatal
        } finally {
          done++;
          onProgress(done, total);
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

  // Pins inside the bounding box — fetched first so their photos count
  // toward the progress total.
  const supabase = createClient();
  const { data } = await supabase
    .from("pins_view")
    .select(PIN_COLUMNS)
    .gte("lat", bounds.south)
    .lte("lat", bounds.north)
    .gte("lng", bounds.west)
    .lte("lng", bounds.east);
  const pins = (data ?? []) as Pin[];

  const imageJobs: ImageJob[] = pins.flatMap((pin) =>
    (pin.images ?? []).map((img) => {
      const bucket = supabase.storage.from("pin-images");
      return {
        path: img.storage_path,
        url: bucket.getPublicUrl(img.storage_path, {
          transform: { width: 640, quality: 55 },
        }).data.publicUrl,
        fallbackUrl: bucket.getPublicUrl(img.storage_path).data.publicUrl,
      };
    })
  );

  const urls = tileUrls(tileTemplate, bounds, minZoom, maxZoom);
  const total = urls.length + imageJobs.length;

  const tileCount = await downloadTiles(urls, packId, total, onProgress);
  const imageCount = await downloadImages(
    imageJobs,
    packId,
    urls.length,
    total,
    onProgress
  );
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
    imageCount,
  };
  await savePack(pack);
  return pack;
}
