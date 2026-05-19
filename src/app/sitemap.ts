import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

// Dynamic sitemap — lists the homepage plus every pin profile page so search
// engines can discover and crawl all /pin/<id> URLs. Regenerated hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const supabase = await createClient();
  const { data } = await supabase
    .from("pins_view")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(50000);

  const pinUrls: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
    url: `${base}/pin/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at as string) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...pinUrls,
  ];
}
