import type { NormalizedEvent, ReviewVenueGeocodeOpsResponse } from "@fresno-events/shared";
import { normalizeVenueStreetAddress } from "@fresno-events/shared";

import type { Env } from "@/env";
import { geocodeAddress, geocodeThrottleMs, sleep } from "@/lib/geocode";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

const PAGE_SIZE = 200;
const BATCH_SIZE = 50;
const PREVIEW_CAP = 500;
const MAX_BATCHES = 200;
const BATCH_PAUSE_MS = 300;
const CANDIDATE_STATUSES = ["pending_review", "needs_changes", "awaiting_enrichment"] as const;

interface VenueGeocodeRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

interface CandidateGeocodeRow {
  id: string;
  normalized_event: NormalizedEvent;
}

export type ReviewVenueGeocodeSummary = ReviewVenueGeocodeOpsResponse["summary"];

export interface ReviewVenueGeocodeBatchProgress {
  batch: number;
  summary: ReviewVenueGeocodeSummary;
  total: ReviewVenueGeocodeSummary;
}

function emptySummary(): ReviewVenueGeocodeSummary {
  return {
    scanned: 0,
    geocoded: 0,
    skipped: 0,
    errors: 0,
    venueScanned: 0,
    candidateScanned: 0,
    candidateGeocoded: 0,
    batchesRun: 0,
    remaining: 0,
    remainingVenues: 0,
    remainingCandidates: 0
  };
}

function addSummaries(
  total: ReviewVenueGeocodeSummary,
  batch: ReviewVenueGeocodeSummary
): ReviewVenueGeocodeSummary {
  return {
    scanned: total.scanned + batch.scanned,
    geocoded: total.geocoded + batch.geocoded,
    skipped: total.skipped + batch.skipped,
    errors: total.errors + batch.errors,
    venueScanned: total.venueScanned + batch.venueScanned,
    candidateScanned: total.candidateScanned + batch.candidateScanned,
    candidateGeocoded: total.candidateGeocoded + batch.candidateGeocoded,
    batchesRun: (total.batchesRun ?? 0) + (batch.batchesRun ?? 0),
    remaining: total.remaining,
    remainingVenues: total.remainingVenues,
    remainingCandidates: total.remainingCandidates
  };
}

function hasCandidateCoords(event: NormalizedEvent): boolean {
  const lat = event.venueLat;
  const lng = event.venueLng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return !(lat === 0 && lng === 0);
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

async function fetchCandidatesMissingCoords(env: Env, limit?: number): Promise<CandidateGeocodeRow[]> {
  const all: CandidateGeocodeRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,normalized_event",
      status: `in.(${CANDIDATE_STATUSES.join(",")})`,
      order: "updated_at.desc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });

    const page = await supabaseReviewRequest<CandidateGeocodeRow[]>(
      env,
      `/rest/v1/event_candidates?${params}`
    );

    for (const row of page) {
      const event = row.normalized_event;
      const address = event.venueAddress?.trim() ?? "";
      if (!address || hasCandidateCoords(event)) {
        continue;
      }
      all.push(row);
      if (limit !== undefined && all.length >= limit) {
        return all.slice(0, limit);
      }
    }

    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

async function countRemainingMissingCoords(
  env: Env
): Promise<{ venues: number; candidates: number; total: number }> {
  const [venues, candidates] = await Promise.all([
    fetchVenuesMissingCoords(env),
    fetchCandidatesMissingCoords(env)
  ]);
  return {
    venues: venues.length,
    candidates: candidates.length,
    total: venues.length + candidates.length
  };
}

async function loadBatchWork(
  env: Env,
  dryRun: boolean,
  cap: number
): Promise<{ venues: VenueGeocodeRow[]; candidates: CandidateGeocodeRow[] }> {
  if (dryRun) {
    const venueCap = Math.ceil(cap / 2);
    const candidateCap = cap - venueCap;
    const venues = await fetchVenuesMissingCoords(env, venueCap);
    const candidates = await fetchCandidatesMissingCoords(env, candidateCap);
    return { venues, candidates };
  }

  const venues = await fetchVenuesMissingCoords(env, cap);
  const remaining = Math.max(0, cap - venues.length);
  const candidates = remaining > 0 ? await fetchCandidatesMissingCoords(env, remaining) : [];
  return { venues, candidates };
}

async function geocodeVenueRow(env: Env, venue: VenueGeocodeRow): Promise<"geocoded" | "skipped" | "error"> {
  const address = venue.address?.trim() ?? "";
  if (!address) {
    return "skipped";
  }

  try {
    const throttleMs = geocodeThrottleMs(env);
    const result = await geocodeAddress(env, { address, city: venue.city });
    if (!result) {
      await sleep(throttleMs);
      return "skipped";
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
    await sleep(throttleMs);
    return "geocoded";
  } catch {
    return "error";
  }
}

async function geocodeCandidateRow(
  env: Env,
  candidate: CandidateGeocodeRow
): Promise<"geocoded" | "skipped" | "error"> {
  const event = candidate.normalized_event;
  const address = normalizeVenueStreetAddress(event.venueAddress, event.venueCity);
  const city = event.venueCity?.trim() || "Fresno";
  if (!address) {
    return "skipped";
  }

  try {
    const throttleMs = geocodeThrottleMs(env);
    const result = await geocodeAddress(env, { address, city });
    if (!result) {
      await sleep(throttleMs);
      return "skipped";
    }

    const nextEvent: NormalizedEvent = {
      ...event,
      venueLat: result.lat,
      venueLng: result.lng
    };
    const params = new URLSearchParams({ id: `eq.${candidate.id}` });
    await supabaseReviewRequest(env, `/rest/v1/event_candidates?${params}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        normalized_event: nextEvent,
        updated_at: new Date().toISOString()
      })
    });
    await sleep(throttleMs);
    return "geocoded";
  } catch {
    return "error";
  }
}

async function runVenueGeocodeBatch(
  env: Env,
  dryRun: boolean,
  cap: number
): Promise<ReviewVenueGeocodeSummary> {
  const { venues, candidates } = await loadBatchWork(env, dryRun, cap);

  let geocoded = 0;
  let candidateGeocoded = 0;
  let errors = 0;
  let skipped = 0;

  for (const venue of venues) {
    if (dryRun) {
      geocoded += 1;
      continue;
    }

    const outcome = await geocodeVenueRow(env, venue);
    if (outcome === "geocoded") {
      geocoded += 1;
    } else if (outcome === "skipped") {
      skipped += 1;
    } else {
      errors += 1;
    }
  }

  for (const candidate of candidates) {
    if (dryRun) {
      geocoded += 1;
      candidateGeocoded += 1;
      continue;
    }

    const outcome = await geocodeCandidateRow(env, candidate);
    if (outcome === "geocoded") {
      geocoded += 1;
      candidateGeocoded += 1;
    } else if (outcome === "skipped") {
      skipped += 1;
    } else {
      errors += 1;
    }
  }

  return {
    scanned: venues.length + candidates.length,
    geocoded,
    skipped,
    errors,
    venueScanned: venues.length,
    candidateScanned: candidates.length,
    candidateGeocoded,
    batchesRun: 1
  };
}

function buildMessage(summary: ReviewVenueGeocodeSummary, dryRun: boolean): string {
  const venuePart = `${summary.venueScanned} venue${summary.venueScanned === 1 ? "" : "s"}`;
  const candidatePart = `${summary.candidateScanned} review candidate${summary.candidateScanned === 1 ? "" : "s"}`;

  if (dryRun) {
    return `Preview: ${venuePart} and ${candidatePart} missing coordinates; ${summary.geocoded} would be geocoded (${summary.candidateGeocoded} candidates).`;
  }

  const batches = summary.batchesRun ?? 1;
  const remaining = summary.remaining ?? 0;
  const remainingNote =
    remaining > 0
      ? ` ${remaining} still missing coordinates (${summary.remainingVenues ?? 0} venues, ${summary.remainingCandidates ?? 0} candidates).`
      : " All rows with addresses now have coordinates.";

  return `Geocoded ${summary.geocoded} rows in ${batches} batch${batches === 1 ? "" : "es"} (${summary.candidateGeocoded} candidates, ${summary.errors} errors, ${summary.skipped} skipped).${remainingNote}`;
}

export function shouldStopGeocodeBatches(batch: ReviewVenueGeocodeSummary): boolean {
  if (batch.scanned === 0) {
    return true;
  }
  if (batch.geocoded === 0) {
    return true;
  }
  return batch.scanned < BATCH_SIZE;
}

export async function runVenueGeocodeOps(
  env: Env,
  dryRun: boolean,
  options: {
    onBatch?: (progress: ReviewVenueGeocodeBatchProgress) => void | Promise<void>;
    singleBatch?: boolean;
  } = {}
): Promise<ReviewVenueGeocodeOpsResponse> {
  if (dryRun) {
    const summary = await runVenueGeocodeBatch(env, true, PREVIEW_CAP);
    const remaining = await countRemainingMissingCoords(env);
    const withRemaining: ReviewVenueGeocodeSummary = {
      ...summary,
      remaining: remaining.total,
      remainingVenues: remaining.venues,
      remainingCandidates: remaining.candidates
    };
    return {
      dryRun: true,
      summary: withRemaining,
      message: buildMessage(withRemaining, true)
    };
  }

  if (options.singleBatch) {
    const summary = await runVenueGeocodeBatch(env, false, BATCH_SIZE);
    const remaining = await countRemainingMissingCoords(env);
    const withRemaining: ReviewVenueGeocodeSummary = {
      ...summary,
      remaining: remaining.total,
      remainingVenues: remaining.venues,
      remainingCandidates: remaining.candidates
    };
    return {
      dryRun: false,
      summary: withRemaining,
      message: buildMessage(withRemaining, false)
    };
  }

  let total = emptySummary();
  let batchNumber = 0;

  while (batchNumber < MAX_BATCHES) {
    const batch = await runVenueGeocodeBatch(env, false, BATCH_SIZE);
    batchNumber += 1;
    total = addSummaries(total, batch);
    total.batchesRun = batchNumber;

    await options.onBatch?.({
      batch: batchNumber,
      summary: batch,
      total: { ...total }
    });

    if (shouldStopGeocodeBatches(batch)) {
      break;
    }

    await sleep(BATCH_PAUSE_MS);
  }

  const remaining = await countRemainingMissingCoords(env);
  total = {
    ...total,
    remaining: remaining.total,
    remainingVenues: remaining.venues,
    remainingCandidates: remaining.candidates
  };

  return {
    dryRun: false,
    summary: total,
    message: buildMessage(total, false)
  };
}
