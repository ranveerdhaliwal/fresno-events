# Homepage cross-source dupes (ZZ Top)

**Status:** smoked  
**Captured:** 2026-08-01  
**Screenshot:** `/home/ranveer/.cursor/projects/home-ranveer-app-fresno-events/assets/c__Users_ranve_AppData_Roaming_Cursor_User_workspaceStorage_64190c42563ed6f12d666c63e5da769c_images_image-986fba50-f89d-4aef-ad86-065264ebd75b.png`

## Why we care

Homepage showed **three cards** for the same ZZ Top night (Aug 7, 8pm, William Saroyan Theatre) from Visit Fresno, FCC scrape, and Ticketmaster — different titles (`ZZ Top Tour` / `ZZ Top` / `ZZ TOP 2026`), venue string variants, and price display.

## Root cause

1. `canonicalOccurrenceTitle` kept trailing `tour` / calendar year → different `occurrence_key`s.
2. Fuzzy title match required `sharedCount >= 3`, so short headliners (`zz` + `top`) never auto-linked even when tokens fully overlapped after stop-word stripping.
3. Published orphan cleanup used weak title/venue normalize (case/whitespace only), so Saroyan name variants and `Tour` suffixes never collided.
4. Sources were approved separately → three scheduled `events` rows.

## Fix shipped

- Strip trailing tour/year noise in `canonicalOccurrenceTitle` (loop until stable).
- Allow strong fuzzy match when short titles fully overlap (≥2 shared tokens, score ≥ 0.95).
- Harden `eventContentSignature` / listing-group keys to use occurrence title + venue + Pacific time bucket.
- Relinked candidates; removed Visit + TM published ZZ Top orphans (kept FCC scrape).

## Related

- `packages/shared/src/occurrence.ts`
- `packages/shared/src/title-similarity.utils.ts`
- `packages/shared/src/event-dedupe.ts`
- [CROSS_SOURCE_DEDUPE.md](../../CROSS_SOURCE_DEDUPE.md)
