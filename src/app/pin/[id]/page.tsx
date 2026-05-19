import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { colorForCategory, labelForService } from "@/lib/pinTaxonomy";
import { siteUrl } from "@/lib/site";
import type { Pin } from "@/lib/supabase";

// Server-rendered pin profile page.
//
// Lives at /pin/<id>. Unlike the map (which renders pin content client-side
// inside a drawer), this page emits the pin's title, description and images
// as real HTML on the server — so social scrapers like facebookexternalhit
// get a proper Open Graph preview and Google can index the content.

type PinRow = Pick<
  Pin,
  | "id"
  | "title"
  | "category"
  | "subcategory"
  | "short_description"
  | "description"
  | "services"
  | "lat"
  | "lng"
  | "created_by"
  | "created_by_name"
  | "created_at"
  | "images"
>;

// Cached so generateMetadata and the page component share a single query
// per request instead of hitting Supabase twice.
const getPin = cache(async (id: string): Promise<PinRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pins_view")
    .select(
      "id, title, category, subcategory, short_description, description, services, lat, lng, created_by, created_by_name, created_at, images"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as PinRow | null) ?? null;
});

function imageUrls(images: PinRow["images"]): string[] {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return [];
  return (images ?? []).map(
    (img) =>
      `${base}/storage/v1/object/public/pin-images/${img.storage_path}`
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pin = await getPin(id);

  if (!pin) {
    return { title: "Pin not found · TravPad" };
  }

  const description =
    pin.short_description ??
    pin.description ??
    "A place pinned on TravPad.";
  const images = imageUrls(pin.images);
  const url = `${siteUrl()}/pin/${pin.id}`;

  return {
    title: `${pin.title} · TravPad`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "TravPad",
      url,
      title: pin.title,
      description,
      images: images.length > 0 ? images : undefined,
    },
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      title: pin.title,
      description,
      images: images.length > 0 ? images : undefined,
    },
  };
}

export default async function PinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pin = await getPin(id);

  if (!pin) notFound();

  const images = imageUrls(pin.images);
  const description = pin.short_description ?? pin.description ?? "";

  // Structured data — helps Google understand this is a geographic place.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: pin.title,
    description: description || undefined,
    url: `${siteUrl()}/pin/${pin.id}`,
    image: images.length > 0 ? images : undefined,
    geo: {
      "@type": "GeoCoordinates",
      latitude: pin.lat,
      longitude: pin.lng,
    },
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="text-sm font-medium text-rose-600 hover:underline"
      >
        ← TravPad
      </Link>

      {images.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0]}
            alt={pin.title}
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      )}

      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.slice(1).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={pin.title}
              className="h-20 w-28 flex-none rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <h1 className="mt-5 text-3xl font-semibold leading-tight">
        {pin.title}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className="rounded-full px-2.5 py-1 font-medium uppercase tracking-wide text-white"
          style={{ backgroundColor: colorForCategory(pin.category) }}
        >
          {pin.category}
        </span>
        {pin.subcategory && (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {pin.subcategory}
          </span>
        )}
      </div>

      {pin.created_by_name && (
        <p className="mt-2 text-xs text-neutral-500">
          Created by{" "}
          <Link
            href={`/?profile=${pin.created_by}`}
            className="font-medium text-rose-600 hover:underline"
          >
            {pin.created_by_name}
          </Link>
        </p>
      )}

      {pin.short_description && (
        <p className="mt-4 border-l-2 border-rose-300 pl-3 text-base font-medium italic text-neutral-700 dark:border-rose-800 dark:text-neutral-200">
          {pin.short_description}
        </p>
      )}

      {pin.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {pin.description}
        </p>
      )}

      {pin.services && pin.services.length > 0 && (
        <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Services
          </h2>
          <div className="flex flex-wrap gap-2">
            {pin.services.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                {labelForService(s)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Link
          href={`/?pin=${pin.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
        >
          <MapPin className="h-4 w-4" />
          Show on map
        </Link>
      </div>
    </main>
  );
}
