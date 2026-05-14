import {
  Wifi,
  Leaf,
  Salad,
  Sun,
  ShoppingBag,
  Dog,
  Coffee,
  WavesLadder,
  ParkingMeter,
  Snowflake,
  Building,
  Accessibility,
  TicketCheck,
  Headphones,
  Camera,
  Backpack,
  Baby,
  Users,
  CalendarDays,
  Sofa,
  Smartphone,
  Luggage,
  Tag,
} from "lucide-react";
import type { ComponentType } from "react";

export const CATEGORIES = [
  "Mat",
  "Boende",
  "Sevärdhet",
  "Aktivitet",
  "Transport",
  "Annat",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SUBCATEGORIES: Record<Category, readonly string[]> = {
  Mat: ["Café", "Restaurang", "Bar", "Bageri", "Streetfood"],
  Boende: ["Hotell", "Hostel", "BnB", "Camping"],
  Sevärdhet: ["Arkitektur", "Museum", "Naturplats", "Religiös", "Historisk"],
  Aktivitet: ["Sport", "Vandring", "Vatten", "Nöjespark"],
  Transport: ["Flygplats", "Tågstation", "Buss", "Färja"],
  Annat: [],
};

export const SERVICES: Record<Category, readonly string[]> = {
  Mat: [
    "wifi",
    "vegan",
    "vegetariskt",
    "utomhus_servering",
    "takeaway",
    "husdjur_ok",
  ],
  Boende: ["wifi", "frukost", "pool", "parkering", "husdjur_ok", "ac"],
  Sevärdhet: [
    "material",
    "tillganglighet",
    "gratis_intrade",
    "audio_guide",
    "fotografering_ok",
  ],
  Aktivitet: ["utrustning_finns", "barnvanligt", "guidad", "sasong"],
  Transport: ["lounge", "wifi", "biljett_app", "bagageforvaring"],
  Annat: [],
};

export const SERVICE_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  vegan: "Vegan",
  vegetariskt: "Vegetariskt",
  utomhus_servering: "Utomhus",
  takeaway: "Takeaway",
  husdjur_ok: "Husdjur ok",
  frukost: "Frukost",
  pool: "Pool",
  parkering: "Parkering",
  ac: "AC",
  material: "Material",
  tillganglighet: "Tillgänglighet",
  gratis_intrade: "Gratis inträde",
  audio_guide: "Audioguide",
  fotografering_ok: "Foto ok",
  utrustning_finns: "Utrustning",
  barnvanligt: "Barnvänligt",
  guidad: "Guidad",
  sasong: "Säsong",
  lounge: "Lounge",
  biljett_app: "Biljett-app",
  bagageforvaring: "Bagageförvaring",
};

type IconCmp = ComponentType<{ className?: string; size?: number | string }>;

export const SERVICE_ICONS: Record<string, IconCmp> = {
  wifi: Wifi,
  vegan: Leaf,
  vegetariskt: Salad,
  utomhus_servering: Sun,
  takeaway: ShoppingBag,
  husdjur_ok: Dog,
  frukost: Coffee,
  pool: WavesLadder,
  parkering: ParkingMeter,
  ac: Snowflake,
  material: Building,
  tillganglighet: Accessibility,
  gratis_intrade: TicketCheck,
  audio_guide: Headphones,
  fotografering_ok: Camera,
  utrustning_finns: Backpack,
  barnvanligt: Baby,
  guidad: Users,
  sasong: CalendarDays,
  lounge: Sofa,
  biljett_app: Smartphone,
  bagageforvaring: Luggage,
};

export function iconForService(service: string): IconCmp {
  return SERVICE_ICONS[service] ?? Tag;
}

export function labelForService(service: string): string {
  return SERVICE_LABELS[service] ?? service;
}
