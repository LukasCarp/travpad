// Resolves the canonical base URL of the deployment.
//
// Priority:
//   1. NEXT_PUBLIC_SITE_URL  — explicit override (set this for a custom domain)
//   2. VERCEL_PROJECT_PRODUCTION_URL — stable production domain on Vercel
//      (e.g. the project's *.vercel.app domain), set automatically by Vercel
//   3. http://localhost:3000 — local development fallback
//
// Used for metadataBase, Open Graph URLs, canonical links and the sitemap so
// shared links and crawlers always get absolute, correct URLs.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
