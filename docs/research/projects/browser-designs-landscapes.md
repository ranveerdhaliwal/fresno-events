# browser-designs landscapes (sibling)

**Links:** `/home/ranveer/app/browser-designs` · [Big Bold Hero](file:///home/ranveer/app/browser-designs/apps/web/src/features/bigboldhero/) · assets under `apps/web/public/assets/*_bg.png` · [REFERENCES.md](file:///home/ranveer/app/browser-designs/REFERENCES.md)

**Why we care:** Fresno Events home is currently a flat dark page + light halftone dots. We want a subtle Central Valley / Yosemite sense of place without fighting cream event cards or slab headers. browser-designs already ships polished full-bleed landscape backgrounds (Oasis, Haven, Vanta, etc.) and related texture work (Aeterna halftone, Conversion noise).

**Status:** `smoked`

**What we shipped:**
- Fixed photo + navy veil + existing halftone, sitewide via `PageChrome` / `HomeAtmosphere`
- **15 public-domain** Sierra / Valley / Sequoia–Kings photos from Wikimedia Commons (NPS / USGS)
- Served at **~2560px desktop** + **~1280px `-sm.jpg` mobile** (picked via `matchMedia` ≤768px); only one file loads per session
- Random pick on each full page load (`pickAtmosphereVariant`)
- Manifest + Commons titles: `apps/web/public/atmosphere/SOURCES.json`
- Toggle: `HOME_ATMOSPHERE` in `apps/web/src/lib/home-atmosphere.ts` (`"veiled-sierra"` | `"none"`)

**Note:** An earlier Diliff Half Dome file was **CC BY-SA 3.0** (not PD) and was removed from the pack.

**What to do later:**
- Optionally day-stable pick (hash of Pacific date) if flicker on remounts bothers anyone
- Add more NPS modern color landscapes when rate limits allow
- Credit strip in footer if we want visible PD attribution
