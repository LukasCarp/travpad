# Launch checklist

Concrete steps to take OpenPin from `*.vercel.app` preview to a real product.
Beta a punkt i taget — ordningen är ungefär den jag skulle ta dem i.

## 1. Domän + hosting

- [ ] Köp domän (Cloudflare Registrar är billigt + DNS gratis)
- [ ] Lägg till domänen i Vercel → Settings → Domains
- [ ] Sätt apex + `www` redirect till canonical
- [ ] Uppdatera `siteUrl()` i `src/lib/site.ts` så den pekar på riktig domän
- [ ] Uppgradera Vercel till Pro ($20/mån) — högre timeout, mer bandbredd
- [ ] Sätt region i `vercel.json` → `arn1` (Stockholm) eller `iad1` (US-East)

## 2. Stadia / map tiles

- [ ] I Stadia-dashboarden: byt domain-restriction från `travpad.vercel.app`
      till din riktiga domän
- [ ] Behåll `travpad.vercel.app` parallellt under övergången
- [ ] Skriv ned vad nuvarande Stadia-plan kostar; vid >100k tile loads/mån,
      utvärdera MapTiler eller self-hosted Protomaps

## 3. Supabase

- [ ] Uppgradera till Pro ($25/mån) — dagliga backups + PITR
- [ ] Verifiera att appen ansluter via **poolad** port 6543, inte 5432
      (`?pgbouncer=true` i connection string)
- [ ] `EXPLAIN ANALYZE` på de tyngsta queries (pins_view, pin_reviews aggregate)
      när rad-antalet växer
- [ ] Kolla att RLS-policies använder index — gör `set role authenticated` i
      SQL editor och kör en pin-fetch
- [ ] Lägg till backup notification om en daily backup failar

## 4. Storage / bilder

- [ ] Lägg Cloudflare CDN framför pin-images bucket
      (custom domain på Supabase Storage + CF proxy)
- [ ] Verifiera att thumbnails alltid begärs med `?width=` eller via Supabase
      Image Transformations — full-size i listvyer dödar mobil
- [ ] Sätt upp larm i Supabase när Storage egress närmar sig free tier-gränsen

## 5. Service worker

- [ ] Bump SW version vid varje deploy (bygginteraktion eller manuellt)
- [ ] Verifiera att `service-worker.js` returnerar `Cache-Control: no-cache`
      från Vercel (`curl -I https://din-domän/sw.js`)
- [ ] Test: deploya ny version, ladda sidan på telefon, ska se nya UI utan
      hard-refresh

## 6. Performance

- [ ] Lighthouse mobile audit — mål: Performance >85, Best Practices >90
- [ ] `next build` lokalt: kolla att inget chunk är >300 KB gzipped
- [ ] `next/dynamic` med `ssr: false` på allt Leaflet-relaterat (redan på MapCanvas)
- [ ] Testa på riktig 3G/4G — Chrome DevTools network throttling

## 7. Rate limiting

- [ ] Lägg rate-limit på `/api/overpass`, `/api/wikidata`, `/api/wikivoyage`
      (t.ex. Upstash Ratelimit, 30 req/min per IP)
- [ ] Logga 429-svar så du ser missbruk

## 8. Felrapportering + analytics

- [ ] Sentry — gratis Vercel integration, fångar JS-fel i prod
- [ ] Vercel Analytics (gratis på Pro) eller Plausible (~$9/mån) för privacy-friendly stats
- [ ] Lägg en error boundary runt MapCanvas så ett trasigt pin-objekt inte
      tar ner hela appen

## 9. Legal / community

- [ ] Skriv riktig `/privacy` (just nu stub)
- [ ] Skriv `/terms` — minst: CC-BY-SA 4.0 på allt user-content, ingen
      kommersiell scraping, ingen spam
- [ ] Per-pin attribution UI för OSM/Wikipedia/Commons-imports
      (se `project_travpad_pending_license_attribution`)
- [ ] Cookie-banner om du lägger till tredje-parts analytics som sätter cookies

## 10. Email + notifikationer

- [ ] Bygg pin-owner notifikationsmail via Resend
      (se `project_travpad_pending_owner_email`)
- [ ] Sätt upp en `noreply@din-domän` adress i Resend
- [ ] SPF/DKIM-records (Cloudflare DNS UI gör det smidigt)

## 11. Innan första PR/sharing-länk

- [ ] OG-bilder syns korrekt — testa `https://din-domän/pin/<id>` i
      https://www.opengraph.xyz
- [ ] `/sitemap.xml` ger riktiga pin-URLs
- [ ] Google Search Console verifiering + sitemap submit

## 12. Soft launch

- [ ] 10–20 betaanvändare (vänner) i en vecka
- [ ] Samla feedback via en enkel form (Tally eller Google Form)
- [ ] Fixa de top-3 friktionerna innan publik lansering

---

### Driftskostnad runt 500 aktiva användare

| Tjänst | Kostnad/mån |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Domän | ~$1 |
| Tiles (MapTiler hobby) | $0–25 |
| Sentry / analytics | $0–9 |
| **Total** | **~$45–80** |
