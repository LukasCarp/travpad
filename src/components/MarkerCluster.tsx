"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { renderToStaticMarkup } from "react-dom/server";
import { useMap } from "react-leaflet";
import type { Pin } from "@/lib/supabase";
import {
  colorForCategory,
  iconForCategory,
  iconForSubcategory,
} from "@/lib/pinTaxonomy";

// Secret-spot pins get a distinct violet badge instead of the standard pin.
const secretIcon = L.divIcon({
  className: "",
  html:
    '<div style="display:flex;align-items:center;justify-content:center;' +
    "width:34px;height:34px;border-radius:9999px;background:#646c5a;" +
    "font-size:18px;border:2px solid #fff;" +
    'box-shadow:0 2px 6px rgba(0,0,0,0.4);">🤫</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// A colored badge carrying the subcategory's lucide icon (or the category's
// icon when a pin has no subcategory), tinted with the main category color.
function buildPinIcon(category: string, subcategory: string | null): L.DivIcon {
  const Icon = subcategory
    ? iconForSubcategory(subcategory)
    : iconForCategory(category);
  const svg = renderToStaticMarkup(
    <Icon color="#fff" size={18} strokeWidth={2.5} />
  );
  return L.divIcon({
    className: "",
    html:
      '<div style="display:flex;align-items:center;justify-content:center;' +
      "width:32px;height:32px;border-radius:9999px;border:2px solid #fff;" +
      `background:${colorForCategory(category)};` +
      `box-shadow:0 2px 6px rgba(0,0,0,0.4);">${svg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Built icons are cached by category+subcategory so each combination is only
// rendered to markup once.
const iconCache = new Map<string, L.DivIcon>();

function pinIcon(pin: Pin): L.DivIcon {
  if (pin.secret) return secretIcon;
  const key = `${pin.category}|${pin.subcategory ?? ""}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = buildPinIcon(pin.category, pin.subcategory);
    iconCache.set(key, icon);
  }
  return icon;
}

type Props = {
  pins: Pin[];
  onPinClick: (pinId: string) => void;
};

export default function MarkerCluster({ pins, onPinClick }: Props) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
    });

    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin) });
      marker.on("click", () => onPinClick(pin.id));
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, pins, onPinClick]);

  return null;
}
