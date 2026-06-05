import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageUp, MapPin, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  colorForCategory,
  iconForCategory,
  iconForSubcategory,
  labelForService,
} from "@/lib/pinTaxonomy";
import { siteUrl } from "@/lib/site";
import PhotoCredit from "@/components/PhotoCredit";
import PinAttribution from "@/components/PinAttribution";
import PinContact from "@/components/PinContact";
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
  | "details"
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
      "id, title, category, subcategory, short_description, description, services, details, lat, lng, created_by, created_by_name, created_at, images"
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
    return { title: "Pin not found · OpenPin" };
  }

  const description =
    pin.short_description ??
    pin.description ??
    "A place pinned on OpenPin.";
  const images = imageUrls(pin.images);
  const url = `${siteUrl()}/pin/${pin.id}`;

  // Thin content — a pin with no description and no image is barely useful
  // to a human and hurts overall index quality, so tell Google not to index
  // it. follow stays true so internal links are still crawled.
  const isThin =
    !pin.description && !pin.short_description && images.length === 0;

  return {
    title: `${pin.title} · OpenPin`,
    description,
    alternates: { canonical: url },
    robots: isThin ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: "OpenPin",
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

  // Check the viewer's session so the Edit button can deep-link signed-in
  // users straight into the map drawer, and bounce signed-out viewers to
  // the login page (an entry point for new sign-ups).
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const images = imageUrls(pin.images);
  const description = pin.short_description ?? pin.description ?? "";

  // Related pins — small internal link graph so Googlebot can crawl from
  // one pin to the next instead of treating every page as an island. We
  // pull a rough bounding box ~5 km wide and let Postgres do the rest.
  const DEG_PER_KM = 1 / 111;
  const NEARBY_RADIUS_KM = 5;
  const dy = NEARBY_RADIUS_KM * DEG_PER_KM;
  const dx = dy / Math.max(Math.cos((pin.lat * Math.PI) / 180), 0.1);

  const [nearbyResp, categoryResp] = await Promise.all([
    supabase
      .from("pins_view")
      .select("id, title, category, subcategory, lat, lng, images")
      .neq("id", pin.id)
      .gte("lat", pin.lat - dy)
      .lte("lat", pin.lat + dy)
      .gte("lng", pin.lng - dx)
      .lte("lng", pin.lng + dx)
      .limit(20),
    supabase
      .from("pins_view")
      .select("id, title, category, subcategory, lat, lng, images")
      .eq("category", pin.category)
      .neq("id", pin.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const nearby = ((nearbyResp.data ?? []) as RelatedPin[])
    .map((p) => ({
      ...p,
      // Quick squared-distance — good enough for sorting at this scale,
      // no need for great-circle math.
      d2: (p.lat - pin.lat) ** 2 + (p.lng - pin.lng) ** 2,
    }))
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, 5);
  const categoryPins = ((categoryResp.data ?? []) as RelatedPin[]).slice(0, 5);

  // Same icon logic as the map markers: prefer the subcategory's icon,
  // fall back to the category's.
  const CategoryIcon = pin.subcategory
    ? iconForSubcategory(pin.subcategory)
    : iconForCategory(pin.category);
  const categoryColor = colorForCategory(pin.category);

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
        ← OpenPin
      </Link>

      {images.length > 0 ? (
        <>
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[0]}
              alt={pin.title}
              className="aspect-[4/3] w-full object-cover"
            />
            <div
              aria-label={pin.subcategory ?? pin.category}
              className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: categoryColor }}
            >
              <CategoryIcon
                className="h-5 w-5 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
          </div>
          <PhotoCredit credit={pin.images?.[0]?.credit_json} className="mt-1" />
        </>
      ) : (
        <div className="relative mt-4 flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <ImageUp
            className="h-24 w-24 text-neutral-400 dark:text-neutral-500"
            aria-hidden="true"
          />
          <div
            aria-label={pin.subcategory ?? pin.category}
            className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: categoryColor }}
          >
            <CategoryIcon
              className="h-5 w-5 text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
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
        <div className="mt-4">
          {(() => {
            const det = (pin.details ?? {}) as {
              wikipedia_lang?: string;
              wikipedia_title?: string;
            };
            const lang = det.wikipedia_lang;
            if (!lang || lang === "en" || !det.wikipedia_title) return null;
            return (
              <p className="mb-2 inline-block rounded-md bg-neutral-100 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                Auto-translated from {lang} Wikipedia
              </p>
            );
          })()}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {pin.description}
          </p>
        </div>
      )}

      <PinContact details={pin.details} className="mt-4" />

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

      <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Link
          href={`/?pin=${pin.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
        >
          <MapPin className="h-4 w-4" />
          Show on map
        </Link>
        <Link
          href={viewer ? `/?pin=${pin.id}` : "/login"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      {nearby.length > 0 && (
        <RelatedPinList heading="Nearby" pins={nearby} />
      )}
      {categoryPins.length > 0 && (
        <RelatedPinList
          heading={`More in ${pin.category}`}
          pins={categoryPins}
        />
      )}

      <PinAttribution
        details={pin.details as Parameters<typeof PinAttribution>[0]["details"]}
        createdByName={pin.created_by_name}
        className="mt-6"
      />
    </main>
  );
}

type RelatedPin = Pick<
  Pin,
  "id" | "title" | "category" | "subcategory" | "lat" | "lng" | "images"
>;

function relatedThumbUrl(images: RelatedPin["images"]): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const first = images?.[0]?.storage_path;
  if (!base || !first) return null;
  return `${base}/storage/v1/object/public/pin-images/${first}`;
}

function RelatedPinList({
  heading,
  pins,
}: {
  heading: string;
  pins: RelatedPin[];
}) {
  return (
    <section className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pins.map((p) => {
          const thumb = relatedThumbUrl(p.images);
          return (
            <li key={p.id}>
              <Link
                href={`/pin/${p.id}`}
                className="group block overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-black/5 transition hover:ring-rose-300 dark:bg-neutral-800 dark:ring-white/10"
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={p.title}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div
                    className="flex aspect-[4/3] w-full items-center justify-center text-white"
                    style={{ backgroundColor: colorForCategory(p.category) }}
                  >
                    <MapPin className="h-6 w-6 opacity-80" />
                  </div>
                )}
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {p.subcategory ?? p.category}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
