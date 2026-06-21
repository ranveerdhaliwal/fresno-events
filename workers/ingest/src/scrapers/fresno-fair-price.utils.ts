import type { NormalizedEvent } from "@fresno-events/shared";

/** Fair API `EventID` values with no gate admission (vendor parking fees are separate). */
export const FRESNO_FAIR_FREE_ADMISSION_EVENT_IDS = new Set([411]);

export function readFresnoFairApiEventId(sourceEventId: string): number | null {
  const match = /venue:big-fresno-fair:(\d+):/.exec(sourceEventId);
  if (!match?.[1]) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function isFresnoFairFreeAdmissionListing(event: NormalizedEvent): boolean {
  if (event.source !== "scrape:www.fresnofair.com") {
    return false;
  }
  const fairEventId = readFresnoFairApiEventId(event.sourceEventId);
  if (fairEventId !== null && FRESNO_FAIR_FREE_ADMISSION_EVENT_IDS.has(fairEventId)) {
    return true;
  }
  return /\bflea market\b/i.test(event.title);
}

/** Mark known no-admission fair listings; clears stale price fields from older ingests. */
export function applyFresnoFairPricePolicy(event: NormalizedEvent): NormalizedEvent {
  if (!isFresnoFairFreeAdmissionListing(event)) {
    return event;
  }

  const { priceNotes: _omit, priceMin: _min, priceMax: _max, ...rest } = event;
  return {
    ...rest,
    isFree: true,
    priceMin: 0,
    priceMax: 0
  };
}

export function parseFresnoFairFreeAdmissionFromHtml(html: string): boolean {
  return /admission is always\s*(?:<strong>\s*)?free(?:\s*<\/strong>)?/i.test(html);
}
