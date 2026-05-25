"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "@/lib/supabase";
import type { OsmBounds } from "@/lib/osmImport";
import DownloadButton from "./DownloadButton";
import MarkerCluster from "./MarkerCluster";
import OsmImportButton from "./OsmImportButton";
import UserLocation from "./UserLocation";

export type MapFocus = {
  lat: number;
  lng: number;
  zoom?: number;
} | null;

const BASEMAPS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  toner: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png?api_key=e31d0557-3829-40e1-8cba-241372d0e4d8",
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
} as const;

export type Basemap = keyof typeof BASEMAPS;

function ClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FocusController({
  focus,
  onConsumed,
}: {
  focus: MapFocus;
  onConsumed: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 14, { duration: 1.2 });
    onConsumed();
  }, [focus, map, onConsumed]);
  return null;
}

const VIEW_KEY = "travpad:mapView";

type SavedView = { lat: number; lng: number; zoom: number };

// The last map view, so a reload reopens where the user left off.
function loadSavedView(): SavedView | null {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
    if (
      v &&
      typeof v.lat === "number" &&
      typeof v.lng === "number" &&
      typeof v.zoom === "number"
    ) {
      return v;
    }
  } catch {
    // unreadable storage — fall back to the default view
  }
  return null;
}

function ViewPersistence() {
  const map = useMap();
  // moveend covers both panning and zooming.
  useMapEvents({
    moveend() {
      const c = map.getCenter();
      try {
        localStorage.setItem(
          VIEW_KEY,
          JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
        );
      } catch {
        // ignore storage write failures
      }
    },
  });
  return null;
}

export type ViewportBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

// Reports the current viewport on mount and on each pan/zoom — used by
// Top Ten mode to re-rank against what's actually visible.
function BoundsReporter({
  onBounds,
}: {
  onBounds: (b: ViewportBounds) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      const b = map.getBounds();
      onBounds({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };
    report();
    map.on("moveend", report);
    map.on("zoomend", report);
    return () => {
      map.off("moveend", report);
      map.off("zoomend", report);
    };
  }, [map, onBounds]);
  return null;
}

export default function MapCanvas({
  pins,
  basemap,
  onMapClick,
  onPinClick,
  focus,
  onFocusConsumed,
  onRequestOsmImport,
  topTenMode = false,
  onBoundsChange,
}: {
  pins: Pin[];
  basemap: Basemap;
  onMapClick: (lat: number, lng: number) => void;
  onPinClick: (pinId: string) => void;
  focus: MapFocus;
  onFocusConsumed: () => void;
  onRequestOsmImport: (bounds: OsmBounds) => void;
  topTenMode?: boolean;
  onBoundsChange?: (b: ViewportBounds) => void;
}) {
  const [savedView] = useState(loadSavedView);

  return (
    <MapContainer
      center={savedView ? [savedView.lat, savedView.lng] : [20, 0]}
      zoom={savedView ? savedView.zoom : 2}
      minZoom={2}
      worldCopyJump
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        key={basemap}
        attribution={BASEMAPS[basemap].attribution}
        url={BASEMAPS[basemap].url}
      />
      <ClickHandler onMapClick={onMapClick} />
      <MarkerCluster
        pins={pins}
        onPinClick={onPinClick}
        topTenMode={topTenMode}
      />
      <UserLocation />
      <DownloadButton tileTemplate={BASEMAPS[basemap].url} />
      <FocusController focus={focus} onConsumed={onFocusConsumed} />
      <ViewPersistence />
      {onBoundsChange && <BoundsReporter onBounds={onBoundsChange} />}
      <OsmImportButton onRequest={onRequestOsmImport} />
    </MapContainer>
  );
}
