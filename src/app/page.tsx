import { Suspense } from "react";
import type { Metadata } from "next";
import OpenPinHome from "@/components/OpenPinHome";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

// Per-pin Open Graph tags so a shared `/?pin=<id>` link gets a proper
// preview card on Facebook and other social networks.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ pin?: string }>;
}): Promise<Metadata> {
  const { pin } = await searchParams;
  if (!pin) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("pins_view")
    .select("title, short_description, description, images")
    .eq("id", pin)
    .maybeSingle();

  if (!data) return {};

  const title = data.title as string;
  const description =
    (data.short_description as string | null) ??
    (data.description as string | null) ??
    "A place pinned on OpenPin";

  const images = (data.images ?? []) as { storage_path: string }[];
  const firstImage = images[0];
  const imageUrl = firstImage
    ? supabase.storage.from("pin-images").getPublicUrl(firstImage.storage_path)
        .data.publicUrl
    : undefined;

  // Canonicalise to /pin/<id>. Without this Google flags /?pin=<id> as
  // "Duplicate without user-selected canonical" because the same pin
  // content is also reachable at /pin/<id> with its own canonical tag.
  const canonical = `${siteUrl()}/pin/${pin}`;

  return {
    title: `${title} · OpenPin`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: imageUrl ? [imageUrl] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OpenPinHome />
    </Suspense>
  );
}
