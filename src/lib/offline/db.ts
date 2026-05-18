// IndexedDB data layer for the offline-map feature.
//
// Three kinds of data are stored locally:
//   - packs : metadata for each downloaded area ("Day 1 — Hike" etc.)
//   - tiles : the map images (one row per tile URL) for a pack
//   - pois  : the pins inside a pack's area
// A small `meta` store remembers which pack is currently active.

import type { Pin } from "@/lib/supabase";

const DB_NAME = "travpad-offline";
const DB_VERSION = 1;

export type OfflinePack = {
  id: string;
  name: string;
  bbox: { south: number; west: number; north: number; east: number };
  minZoom: number;
  maxZoom: number;
  createdAt: string;
  tileCount: number;
  poiCount: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("packs")) {
        db.createObjectStore("packs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tiles")) {
        const tiles = db.createObjectStore("tiles", { keyPath: "url" });
        tiles.createIndex("packId", "packId", { unique: false });
      }
      if (!db.objectStoreNames.contains("pois")) {
        const pois = db.createObjectStore("pois", {
          keyPath: ["packId", "id"],
        });
        pois.createIndex("packId", "packId", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Run a transaction and resolve once it fully commits.
function run<T>(
  store: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        let result: T;
        Promise.resolve(fn(tx)).then(
          (r) => {
            result = r;
          },
          (err) => {
            reject(err);
            tx.abort();
          }
        );
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Packs -----------------------------------------------------------------

export function savePack(pack: OfflinePack): Promise<void> {
  return run("packs", "readwrite", (tx) => {
    tx.objectStore("packs").put(pack);
  });
}

export function listPacks(): Promise<OfflinePack[]> {
  return run("packs", "readonly", (tx) =>
    reqAsPromise(tx.objectStore("packs").getAll() as IDBRequest<OfflinePack[]>)
  );
}

export function getPack(id: string): Promise<OfflinePack | undefined> {
  return run("packs", "readonly", (tx) =>
    reqAsPromise(
      tx.objectStore("packs").get(id) as IDBRequest<OfflinePack | undefined>
    )
  );
}

export function deletePack(id: string): Promise<void> {
  return run(["packs", "tiles", "pois"], "readwrite", async (tx) => {
    tx.objectStore("packs").delete(id);
    for (const storeName of ["tiles", "pois"] as const) {
      const index = tx.objectStore(storeName).index("packId");
      const keys = await reqAsPromise(index.getAllKeys(id));
      for (const key of keys) {
        tx.objectStore(storeName).delete(key as IDBValidKey);
      }
    }
  });
}

// --- Tiles -----------------------------------------------------------------

export function saveTile(
  packId: string,
  url: string,
  blob: Blob
): Promise<void> {
  return run("tiles", "readwrite", (tx) => {
    tx.objectStore("tiles").put({ url, packId, blob });
  });
}

export function getTileBlob(url: string): Promise<Blob | undefined> {
  return run("tiles", "readonly", async (tx) => {
    const row = (await reqAsPromise(
      tx.objectStore("tiles").get(url)
    )) as { blob: Blob } | undefined;
    return row?.blob;
  });
}

// --- POIs ------------------------------------------------------------------

export function savePois(packId: string, pins: Pin[]): Promise<void> {
  return run("pois", "readwrite", (tx) => {
    const store = tx.objectStore("pois");
    for (const pin of pins) {
      store.put({ packId, id: pin.id, pin });
    }
  });
}

export function getPois(packId: string): Promise<Pin[]> {
  return run("pois", "readonly", async (tx) => {
    const rows = (await reqAsPromise(
      tx.objectStore("pois").index("packId").getAll(packId)
    )) as { pin: Pin }[];
    return rows.map((r) => r.pin);
  });
}

// --- Active pack -----------------------------------------------------------

export function setActivePackId(id: string | null): Promise<void> {
  return run("meta", "readwrite", (tx) => {
    tx.objectStore("meta").put({ key: "activePackId", value: id });
  });
}

export function getActivePackId(): Promise<string | null> {
  return run("meta", "readonly", async (tx) => {
    const row = (await reqAsPromise(
      tx.objectStore("meta").get("activePackId")
    )) as { value: string | null } | undefined;
    return row?.value ?? null;
  });
}
