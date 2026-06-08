import type { ReviewVenueGeocodeOpsResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { geocodeAddress, geocodeThrottleMs, sleep } from "@/lib/geocode";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

const PAGE_SIZE = 200;
const MAX_APPLY = 50;

interface VenueGeocodeRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

async function fetchVenuesMissingCoords(env: Env, limit?: number): Promise<VenueGeocodeRow[]> {
  const all: VenueGeocodeRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,name,address,city,lat,lng",
      lat: "is.null",
      address: "not.is.null",
      order: "updated_at.desc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });

    const page = await supabaseReviewRequest<VenueGeocodeRow[]>(env, `/rest/v1/venues?${params}`);
    const withAddress = page.filter((row) => (row.address?.trim().length ?? 0) > 0);
    all.push(...withAddress);

    if (limit !== undefined && all.length >= limit) {
      return all.slice(0, limit);
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

function buildMessage(summary: ReviewVenueGeocodeOpsResponse["summary"], dryRun: boolean): string {
  if (dryRun) {
    return `Preview: ${summary.scanned} venues missing coordinates; ${summary.geocoded} would be geocoded.`;
  }
  return `Geocoded ${summary.geocoded} venues (${summary.errors} errors, ${summary.skipped} skipped).`;
}

export async function runVenueGeocodeOps(
  env: Env,
  dryRun: boolean,
  options: { limit?: number } = {}
): Promise<ReviewVenueGeocodeOpsResponse> {
  const cap = dryRun ? options.limit ?? 500 : Math.min(options.limit ?? MAX_APPLY, MAX_APPLY);
  const venues = await fetchVenuesMissingCoords(env, cap);

  let geocoded = 0;
  let errors = 0;
  let skipped = 0;

  for (const venue of venues) {
    const address = venue.address?.trim() ?? "";
    if (!address) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      geocoded += 1;
      continue;
    }

    try {
      const throttleMs = geocodeThrottleMs(env);
      const result = await geocodeAddress(env, { address, city: venue.city });
      if (!result) {
        skipped += 1;
        await sleep(throttleMs);
        continue;
      }

      const params = new URLSearchParams({ id: `eq.${venue.id}` });
      await supabaseReviewRequest(env, `/rest/v1/venues?${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          lat: result.lat,
          lng: result.lng,
          updated_at: new Date().toISOString()
        })
      });
      geocoded += 1;
    } catch {
      errors += 1;
    }

    await sleep(geocodeThrottleMs(env));
  }

  const summary = {
    scanned: venues.length,
    geocoded,
    skipped,
    errors
  };

  return {
    dryRun,
    summary,
    message: buildMessage(summary, dryRun)
  };
}
