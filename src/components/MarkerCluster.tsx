"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Star } from "lucide-react";
import { useMap } from "react-leaflet";
import type { Pin } from "@/lib/supabase";
import {
  colorForCategory,
  iconForCategory,
  iconForSubcategory,
} from "@/lib/pinTaxonomy";

const SECRET_STAR_SVG = renderToStaticMarkup(
  <Star color="#fbbf24" fill="#fbbf24" size={18} strokeWidth={2} />
);

// Secret-spot pins get a distinct sage badge with a filled gold star.
const secretIcon = L.divIcon({
  className: "",
  html:
    '<div style="display:flex;align-items:center;justify-content:center;' +
    "width:34px;height:34px;border-radius:9999px;background:#646c5a;" +
    "border:2px solid #fff;" +
    'box-shadow:0 2px 6px rgba(0,0,0,0.4);">' +
    SECRET_STAR_SVG +
    "</div>",
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

// Numbered gold marker for the Top Ten ranking.
function buildRankIcon(rank: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      '<div style="display:flex;align-items:center;justify-content:center;' +
      "width:34px;height:34px;border-radius:9999px;background:#fbbf24;" +
      "color:#111;font-weight:700;font-size:15px;" +
      "border:2px solid #fff;" +
      `box-shadow:0 2px 6px rgba(0,0,0,0.4);">${rank}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

// Cluster badge for Top Ten — shows the best (lowest) rank in the cluster
// with a small "+N" tail when more ranks are hidden inside.
function buildRankClusterIcon(minRank: number, count: number): L.DivIcon {
  const tail =
    count > 1
      ? `<sup style="font-size:9px;font-weight:600;margin-left:1px;opacity:0.85;">+${count - 1}</sup>`
      : "";
  return L.divIcon({
    className: "",
    html:
      '<div style="display:flex;align-items:center;justify-content:center;' +
      "width:40px;height:40px;border-radius:9999px;background:#fbbf24;" +
      "color:#111;font-weight:700;font-size:15px;line-height:1;" +
      "border:2px solid #fff;" +
      `box-shadow:0 2px 8px rgba(0,0,0,0.4);">${minRank}${tail}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
}

type RankMarker = L.Marker & { __rank?: number };

type Props = {
  pins: Pin[];
  onPinClick: (pinId: string) => void;
  topTenMode?: boolean;
};

export default function MarkerCluster({
  pins,
  onPinClick,
  topTenMode = false,
}: Props) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      // In Top Ten we hijack the cluster click to always spiderfy, so the
      // built-in zoom-to-bounds is turned off.
      zoomToBoundsOnClick: !topTenMode,
      // Tight radius in Top Ten — we want numbers visible whenever possible,
      // only collapsing when markers genuinely overlap.
      maxClusterRadius: topTenMode ? 30 : 50,
      iconCreateFunction: topTenMode
        ? (c) => {
            const children = c.getAllChildMarkers() as RankMarker[];
            const ranks = children
              .map((m) => m.__rank)
              .filter((r): r is number => typeof r === "number");
            const minRank = ranks.length ? Math.min(...ranks) : children.length;
            return buildRankClusterIcon(minRank, children.length);
          }
        : undefined,
    });

    if (topTenMode) {
      cluster.on("clusterclick", (e: L.LeafletEvent) => {
        const layer = (e as unknown as { layer: L.MarkerCluster }).layer;
        layer.spiderfy();
      });
    }

    pins.forEach((pin, idx) => {
      const icon = topTenMode ? buildRankIcon(idx + 1) : pinIcon(pin);
      const marker = L.marker([pin.lat, pin.lng], { icon }) as RankMarker;
      if (topTenMode) marker.__rank = idx + 1;
      marker.on("click", () => onPinClick(pin.id));
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, pins, onPinClick, topTenMode]);

  return null;
}
