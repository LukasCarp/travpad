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
  CATEGORIES,
  colorForCategory,
  iconForCategory,
} from "@/lib/pinTaxonomy";

// Leaflet's default icon assets break under bundlers; point them at the CDN.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Secret-spot pins get a distinct violet badge instead of the standard pin.
const secretIcon = L.divIcon({
  className: "",
  html:
    '<div style="display:flex;align-items:center;justify-content:center;' +
    "width:34px;height:34px;border-radius:9999px;background:#7c3aed;" +
    "font-size:18px;border:2px solid #fff;" +
    'box-shadow:0 2px 6px rgba(0,0,0,0.4);">🤫</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// One colored badge per main category, carrying that category's lucide icon.
function buildCategoryIcon(category: string): L.DivIcon {
  const Icon = iconForCategory(category);
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

const categoryIcons = new Map<string, L.DivIcon>(
  CATEGORIES.map((c) => [c, buildCategoryIcon(c)])
);

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
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pin.secret
          ? secretIcon
          : categoryIcons.get(pin.category) ?? defaultIcon,
      });
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
