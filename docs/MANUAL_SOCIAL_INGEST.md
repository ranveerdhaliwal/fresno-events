# Manual social event ingest (Instagram / Facebook)

Venues that only post on Instagram or Facebook are **out of scope** for automated venue ingest.

## v1 workflow (operator)

1. Open the event or calendar post in the browser.
2. Copy title, date/time, venue, and link.
3. Add via admin (future: paste JSON or bookmarklet) or track in a spreadsheet until tooling exists.

## Planned tooling (not built yet)

| Option | Description |
| --- | --- |
| Bookmarklet | Run on current page → copy normalized event JSON to clipboard |
| Chrome extension | Same, optional one-click POST to dev API |
| Admin paste form | Paste JSON → create `event_candidates` row |

## Do not automate yet

- Instagram Graph API requires business verification and app review.
- Scraping logged-in feeds breaks often and conflicts with platform ToS.
- Goldstein's and similar IG-primary venues: manual until v1 tooling ships.
