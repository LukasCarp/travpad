"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "@/lib/supabase";
import MarkerCluster from "./MarkerCluster";
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

export default function MapCanvas({
  pins,
  basemap,
  onMapClick,
  onPinClick,
  focus,
  onFocusConsumed,
}: {
  pins: Pin[];
  basemap: Basemap;
  onMapClick: (lat: number, lng: number) => void;
  onPinClick: (pinId: string) => void;
  focus: MapFocus;
  onFocusConsumed: () => void;
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
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
      <MarkerCluster pins={pins} onPinClick={onPinClick} />
      <UserLocation />
      <FocusController focus={focus} onConsumed={onFocusConsumed} />
    </MapContainer>
  );
}
