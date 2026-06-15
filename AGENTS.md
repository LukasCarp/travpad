<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16.2.6) has breaking changes — APIs, conventions, and file structure may differ from training data. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OpenPin

Wiki-style travel map. Anyone logged in can add or edit pins; each pin has a change history. Brand is **OpenPin** (domain: `openpin.app`), but the folder and GitHub repo are still named `travpad` — that's intentional, no rename has been done.

## Stack

- **Next.js 16.2.6** App Router, React 19, TypeScript, Turbopack
- **Tailwind v4** (PostCSS plugin, no `tailwind.config`)
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — Postgres + PostGIS, Auth, Storage, RLS on every table
- **Leaflet 1.9** + `react-leaflet` 5 + `leaflet.markercluster` for the map
- **vaul** for drawers, **lucide-react** for icons
- **exifr** + **browser-image-compression** for client-side image handling
- **@anthropic-ai/sdk** for the `/api/compass` AI feature

## Layout

```
src/
  app/                  # App Router
    page.tsx            # map home; reads `?pin=` for OG metadata
    pin/[id]/           # canonical pin page
    profile/[id]/       # public profile
    auth/callback/      # Supabase OAuth callback
    login/, about/, privacy/, credits/
    api/
      compass/[userId]/ # Anthropic-powered recommendations
      overpass/         # OSM Overpass proxy
      wikidata/, wikidata-themed/, wikivoyage/
  components/           # 40+ client components (map, drawers, forms)
  lib/
    supabase/
      client.ts         # browser client
      server.ts         # RSC/route-handler client
      middleware.ts     # session refresh
    offline/            # offline tile + IndexedDB cache
    osmImport.ts        # OSM → pin import
    pinTaxonomy.ts      # category/subcategory definitions
    site.ts             # siteUrl() — canonical base URL resolver
    avatar.ts
  data/unesco-sites.json
  proxy.ts
supabase/
  schema.sql            # base view + RPCs (run once)
  migrations/0002–0020  # numbered, append-only
```

## Supabase patterns

- **Reads** go through `pins_view` (joins images JSON + creator display name; exposes `lat`/`lng` instead of PostGIS geometry).
- **Writes** go through the `create_pin(title, category, lat, lng, details)` RPC — it builds the PostGIS point server-side and stamps `auth.uid()`.
- **RLS is on for every table.** Default: any authenticated user can `insert`, only the owner can `update`/`delete`. Never bypass with `service_role` from a client component.
- **Migrations are append-only**, numbered `00NN_short_name.sql`. Add a new one rather than editing existing ones. Latest: `0020_rebrand_to_openpin.sql`.
- **Key tables**: `pins`, `pin_images` (with `credit_json` for Commons attribution), `pin_reviews`, `pin_history` (wiki change log), `profiles` (default display_name `"Traveler-xxxx"` to avoid email leaks), `follows`, `pin_follows`, `lists`, `list_pins`, `messages`, `badges`, `user_badges`.

## SSR gotchas

- **Leaflet must be dynamic-imported with `ssr: false`** — it touches `window` at module load. Same for any component that imports it transitively (`MapCanvas`, `MarkerCluster`, etc.).
- Use `createClient()` from `lib/supabase/server.ts` inside server components and route handlers; `lib/supabase/client.ts` inside `'use client'` components.
- For canonical URLs / metadata / sitemap, always call `siteUrl()` from `lib/site.ts` — never hardcode the domain. Priority: `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `localhost:3000`.

## Conventions

- TypeScript strict; path alias `@/*` → `src/*`.
- No `tailwind.config` — Tailwind v4 reads `globals.css` directly.
- Pin categories live in `lib/pinTaxonomy.ts`; adding one means: update taxonomy + add migration if it changes any DB enum + add icon mapping.
- Brand strings say "OpenPin"; only the folder, GitHub repo, and some internal paths say "travpad". Don't auto-rename either.

## Scripts

```
npm run dev      # next dev (Turbopack)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

No typecheck script — run `npx tsc --noEmit` directly if needed.

## Deferred / known TODO

- **Pin-owner email via Resend** is deferred until go-live — not built yet.
- OSM/Wikipedia bulk import flow is partial (`osmImport.ts`, `OsmImportDrawer.tsx`, `/api/overpass`).
- Offline maps work but UX is rough (`OfflinePacks`, `OfflineImage`, `lib/offline/`).

## Practical gotchas

- **localStorage / IndexedDB names**: `openpin:mapView`, `openpin:categoryFilter` (with one-shot fallback from the legacy `travpad:` keys); IndexedDB is `openpin-offline`. Bump the DB version when the schema changes; bump the Service Worker cache version on each deploy.
- **Photo attribution is a legal requirement, not a nice-to-have.** `pin_images.credit_json` is populated at import via `fetchCommonsCredit()` in `osmImport.ts`; `<PhotoCredit />` must render on any view that shows a Commons-sourced photo (CC BY / BY-SA require attribution *at* the work, not behind `/credits`).
- **Mobile EXIF GPS is unreliable.** Android 13+ Photo Picker and iOS Photos strip GPS on share. `AddPinFab` has three input paths: pick-on-map, camera capture (`capture="environment"` preserves GPS), gallery upload (falls back to map-pick when EXIF GPS is missing). Desktop file pickers are the only reliable path.
- **SEO crawl graph**: `/pin/[id]` renders "Nearby" + "More in {category}" grids so Googlebot can hop between pin pages instead of treating each as an island. `generateMetadata` sets `robots: index=false` on pins missing both description and image to preserve crawl budget.
- **Per-pin OG metadata fires from two routes** — `/pin/[id]/page.tsx` and `/?pin=<id>` (via `src/app/page.tsx`'s `generateMetadata`). Keep them in sync when the schema or fallback copy changes.
- **Google OAuth consent screen** still reads "Continue to kadgo…supabase.co" because the OAuth app isn't formally verified. Cosmetic, not blocking; documented in LAUNCH.md.
- **Operational checklist for go-live** (domain, Stadia API key whitelist, Supabase Auth redirect URLs, Google Search Console, Resend, social handles, costs) lives in `LAUNCH.md` at the repo root — don't duplicate it here.
