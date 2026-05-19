import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Permissive robots.txt — allow all crawlers, including social scrapers
// like facebookexternalhit, to read pages for link previews. Points crawlers
// at the sitemap so every /pin/<id> page gets discovered.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
