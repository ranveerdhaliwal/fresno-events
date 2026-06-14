import type { VenuniteEvent, VenuniteVenueDetail } from "./venunite.types";
import { VenuniteVenueDetailSchema } from "./venunite.types";
import { shouldSkipModule, shouldSkipVenue, sleep } from "./venunite.utils";

const VENUNITE_VENUE_API = "https://venunite.com/api/venues";

export interface LoadVenuniteVenueDetailsOptions {
  userAgent: string;
  signal?: AbortSignal;
  delayMs?: number;
  fetchImpl?: typeof fetch;
}

export function collectVenuniteVenueIds(
  events: VenuniteEvent[],
  skipModules: readonly string[]
): number[] {
  const ids = new Set<number>();
  for (const event of events) {
    if (shouldSkipModule(event.sourceModule, skipModules) || shouldSkipVenue(event)) {
      continue;
    }
    if (event.venueId != null) {
      ids.add(event.venueId);
    }
  }
  return [...ids];
}

/** Fetch `/api/venues/{id}` for ids not already in cache (polite delay between new requests). */
export async function loadVenuniteVenueDetails(
  venueIds: Iterable<number>,
  cache: Map<number, VenuniteVenueDetail>,
  options: LoadVenuniteVenueDetailsOptions
): Promise<void> {
  const fetchFn = options.fetchImpl ?? fetch;
  const delayMs = options.delayMs ?? 250;

  for (const id of venueIds) {
    if (cache.has(id)) {
      continue;
    }
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const response = await fetchFn(`${VENUNITE_VENUE_API}/${id}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent
      },
      ...(options.signal ? { signal: options.signal } : {})
    });

    if (response.ok) {
      cache.set(id, VenuniteVenueDetailSchema.parse(await response.json()));
    }

    await sleep(delayMs);
  }
}
