# Venue location (addresses, coordinates, geocoding, maps)

Reference for AI agents and humans when changing how venues are located, displayed on maps, or geocoded.

**Related:** [VENUE_INGEST.md](VENUE_INGEST.md), [INGEST.md](INGEST.md), [INGEST_TESTING.md](INGEST_TESTING.md), [DATABASE_ACCESS.md](DATABASE_ACCESS.md)

---

## Data model

### `venues` table (canonical location store)

Published events point at one venue row via `events.venue_id`. Coordinates live on the **venue**, not duplicated per event.

| Column | Role |
| --- | --- |
| `name`, `slug` | Display name; `slug` from `slugify(venueName)` at upsert |
| `address` | Street / mailing line (normalized before write) |
| `city` | City (Clovis, Kingsburg, etc. are valid — do not force everything to Fresno) |
| `lat`, `lng` | `double precision`, nullable — required for Leaflet mini-map and internal `/map` pins |

### `NormalizedEvent` (candidates + admin patches)

In [`packages/shared`](../packages/shared/src/index.ts):

- `venueAddress`, `venueCity` — strings from ingest or admin edit
- `venueLat`, `venueLng` — optional numbers on patch; flow through approve/save → `upsertVenue`

### `event_candidates.normalized_event` (JSON)

Same shape as `NormalizedEvent`. Ingest writes address fields per source; coords when the source provides them.

---

## Shared address pipeline

[`packages/shared/src/venue-location.utils.ts`](../packages/shared/src/venue-location.utils.ts) — single source of truth:

| Function | Use |
| --- | --- |
| `parseMailingAddress` | Strip `, City, ST ZIP` tails (including duplicated suffixes) |
| `resolveVenueLocationFields` | Split mailing-line vs `venueCity` at ingest |
| `normalizeVenueStreetAddress` | Clean street before DB write (`upsertVenue`, geocode input) |
| `buildGoogleMapsSearchQuery` / `buildGoogleMapsSearchUrl` | Public “Open in Google Maps” link — prefers lat/lng, falls back to street + city |
| `isValidCoordinate` | Validate lat/lng |

**Address backfill ≠ geocode.** Backfill fixes string shape (`venues.address`, candidate JSON). It does **not** fill `lat`/`lng`.

---

## Per-source ingest: address vs coordinates

| Source | Address | `venueLat` / `venueLng` |
| --- | --- | --- |
| **VenuNite** | Venue detail API | Yes — [`venunite-venue.utils.ts`](../workers/ingest/src/scrapers/venunite-venue.utils.ts) |
| **Ticketmaster** | Venue block | Yes — `location.latitude` / `longitude` |
| **Big Fresno Fair API** | `AddressLine1`, else `1121 S. Chance Avenue, Fresno, CA 93702` | Yes — fair location coords |
| **Save Mart API** | From listing/detail | Yes when API provides coords |
| **Visit Fresno** | `address1` + `city` normalized at scrape + detail merge | **No** — CMS address only |
| **MiLB / most venue HTML scrapers** | Varies | Usually no |
| **Downtown Fresno** | From API/HTML | Usually no |

When adding a scraper: set `venueAddress` + `venueCity` at minimum; set `venueLat`/`venueLng` on `NormalizedEvent` when the upstream API exposes coordinates.

---

## Persist path (approve → published)

```
Admin approve / save patch
  → mergeNormalizedEvent
  → upsertVenue (apps/api/src/routes/review-event.service.ts)
      → normalize street address
      → reuse existing venue.lat/lng by slug if present
      → else geocodeAddress (if address + no coords)
      → POST venues on_conflict=slug (merge-duplicates)
  → events.venue_id = venue.id
```

`upsertVenue` only sends `lat`/`lng` when known — it does not clear existing coordinates.

---

## Geocoding

### API implementation

| File | Role |
| --- | --- |
| [`apps/api/src/lib/geocode.ts`](../apps/api/src/lib/geocode.ts) | `geocodeAddress(env, { address, city })` |
| [`apps/api/src/lib/google-maps-platform.ts`](../apps/api/src/lib/google-maps-platform.ts) | `resolveGoogleMapsPlatformApiKey(env)` |

**Provider order:**

1. **Google Geocoding API** when `GOOGLE_MAPS_PLATFORM_API_KEY` is set (server-side only)
2. **Nominatim** (OpenStreetMap) fallback — free, ~1 req/sec, Fresno bounding box

Input is always normalized via `resolveVenueLocationFields` before the external call.

### Env var

In `dev-target.env` (not committed):

```bash
GOOGLE_MAPS_PLATFORM_API_KEY=...
```

Regenerate worker env: `pnpm env:local` | `pnpm env:cloud-dev`.  
Cloud deploy: `wrangler secret put GOOGLE_MAPS_PLATFORM_API_KEY --env dev`

Key should be restricted in Google Cloud Console to: Geocoding, Weather, Air Quality, Pollen, Time Zone, Geolocation, Address Validation — **not** Maps JavaScript / tile APIs unless you add map tiles later.

### Admin HTTP routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /review/geocode?address=&city=` | `x-admin-token` | Single address lookup (location picker “Geocode from address”) |
| `POST /review/ops/venue-geocode?dry_run=true` | admin | Bulk backfill preview |
| `POST /review/ops/venue-geocode` | admin | Apply — up to **50 venues/run**, rate-limited |

Client: [`apps/web/src/features/admin/admin-api.ts`](../apps/web/src/features/admin/admin-api.ts) — `geocodeVenueAddress`, `runVenueGeocodeOps`.

### When geocoding runs

| Trigger | Where |
| --- | --- |
| **Approve / save published event** | `upsertVenue` if venue slug has no coords and address present |
| **Admin location picker** | `GET /review/geocode` |
| **Maintenance → Geocode venues** | `review-venue-geocode.service.ts` |
| **Not on public page load** | Event detail never geocodes at render time |

---

## Address backfill (string cleanup)

Normalizes mailing-line addresses on **candidates** and **`venues`** (not geocoding).

| Layer | Path |
| --- | --- |
| Ingest worker | `POST /venue-address-backfill/trigger` — [`venue-address-backfill.ts`](../workers/ingest/src/venue-address-backfill.ts) |
| API proxy | `POST /review/ops/venue-address-backfill` — requires ingest worker (`pnpm ingest:dev`) |
| CLI | `pnpm db:backfill-addresses [--dry-run] [--source=api:visitfresnocounty]` |

Admin UI: **Queue maintenance → Venue addresses** (Preview / Fix).

---

## Public event detail (maps UX)

[`EventDetailView`](../apps/web/src/features/event-detail-sections/EventDetailView.tsx):

| `venue.lat` + `venue.lng` | UI |
| --- | --- |
| **Present** | `VenueMiniMap` (Leaflet, read-only) + address + “Open in Google Maps →” |
| **Missing** | Address line + Google Maps link only (**no** decorative fake map) |

Address display: [`formatVenueAddressLine`](../apps/web/src/lib/venue-display.utils.ts) — avoids duplicating city when already in the street string.

---

## Admin location editing

| Surface | Component |
| --- | --- |
| Review queue | `CandidateDetail` → `AdminLocationPicker` |
| Live events | `PublishedEventDetail` → same picker |

[`AdminLocationPicker`](../apps/web/src/features/admin-location/AdminLocationPicker.tsx): Leaflet map, draggable pin, geocode-from-address button. Draft `venueLat`/`venueLng` strings in [`AdminEventFormState`](../apps/web/src/features/admin/admin-form.types.ts) → `formStateToEventPatch` → `upsertVenue`.

Admin load path must select `venues.lat,lng` — see `getPublishedEventForAdmin` / `published-event-normalize.utils.ts`.

---

## Internal dev tools (no public nav)

| Route | Notes |
| --- | --- |
| `/map` | Leaflet pins; `GET /events?require_coords=true`; shows “N hidden (no coordinates)” |
| `/search` | `GET /search?q=` — events, venues, artists |

---

## Ops checklist

### Backfill existing catalog (local)

```bash
pnpm ingest:dev                    # for address backfill endpoint
pnpm db:backfill-addresses --dry-run
pnpm db:backfill-addresses
# API worker running with GOOGLE_MAPS_PLATFORM_API_KEY
# Admin → maintenance → Geocode venues → Preview → Geocode
# Repeat geocode until preview shows 0 (50 venues per apply)
```

### Verify in SQL

```sql
SELECT name, address, city, lat, lng
FROM venues
WHERE address IS NOT NULL AND lat IS NULL
LIMIT 20;
```

### Test promote + geocode

Pick a pending candidate whose venue row does not exist yet (e.g. new stadium name). Approve in `/admin`. Confirm `venues.lat/lng` populated and event detail shows mini-map.

---

## Future / out of scope

- Ingest-time geocode on every candidate persist (would increase API usage; today geocode runs at `upsertVenue` only)
- Maps JavaScript tiles on public site (we use Leaflet + Carto Voyager, not Google map tiles)
- `geocoded_at` / `geocode_status` columns on `venues` (not implemented; failures retry on next bulk run)

## Key files (quick index)

```
packages/shared/src/venue-location.utils.ts
workers/ingest/src/venue-address-backfill.ts
apps/api/src/lib/geocode.ts
apps/api/src/lib/google-maps-platform.ts
apps/api/src/routes/review-venue-geocode.service.ts
apps/api/src/routes/review-event.service.ts          # upsertVenue
apps/web/src/features/admin-location/
apps/web/src/components/VenueMiniMap/
apps/web/src/features/admin-review/AdminMaintenancePanel.tsx
scripts/backfill-venue-addresses.sh
dev-target.env.example                               # GOOGLE_MAPS_PLATFORM_API_KEY
```
