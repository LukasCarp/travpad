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
  onMapClick,
  onPinClick,
  focus,
  onFocusConsumed,
}: {
  pins: Pin[];
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <MarkerCluster pins={pins} onPinClick={onPinClick} />
      <UserLocation />
      <FocusController focus={focus} onConsumed={onFocusConsumed} />
    </MapContainer>
  );
}
