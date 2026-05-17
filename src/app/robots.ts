import type { MetadataRoute } from "next";

// Permissive robots.txt — allow all crawlers, including social scrapers
// like facebookexternalhit, to read pages for link previews.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
