"use client";

// OSM import button — TEST FEATURE, easy to remove (see src/lib/osmImport.ts).
//
// Rendered inside MapCanvas so it can read the current map bounds.

import { useMap } from "react-leaflet";
import { Sparkles } from "lucide-react";
import type { OsmBounds } from "@/lib/osmImport";
import { useAuth } from "./AuthProvider";

export default function OsmImportButton({
  onRequest,
}: {
  onRequest: (bounds: OsmBounds) => void;
}) {
  const map = useMap();
  const { user } = useAuth();

  function click() {
    const b = map.getBounds();
    onRequest({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={!user}
      aria-label="Import places from OpenStreetMap"
      title={user ? "Import from OSM" : "Sign in to import from OSM"}
      className={
        "fixed bottom-56 left-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-2xl ring-1 ring-black/10 transition dark:bg-neutral-900 dark:text-neutral-200 " +
        (user
          ? "hover:bg-neutral-50 hover:text-rose-500 dark:hover:bg-neutral-800"
          : "cursor-not-allowed opacity-50")
      }
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
