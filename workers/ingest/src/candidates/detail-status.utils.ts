import type { CandidateDetailStatus, NormalizedEvent } from "@fresno-events/shared";

import { hasSufficientReviewData } from "@/candidates/enrichment-candidate.utils";
import { buildVenuniteEventPublicUrl } from "@/scrapers/venunite-detail.utils";
import {
  isEventbriteEventUrl,
  normalizeEventbriteEventUrl,
  resolveEventbriteUrlFromEvent
} from "@/scrapers/eventbrite-detail.utils";

function venuniteSlugFromTags(tags: string[] | undefined): string | null {
  const tag = tags?.find((entry) => entry.startsWith("venunite_slug:"));
  if (!tag) {
    return null;
  }
  const slug = tag.slice("venunite_slug:".length).trim();
  return slug || null;
}

export function canonicalDetailPageUrl(event: NormalizedEvent): string | null {
  const eventbriteUrl = resolveEventbriteUrlFromEvent(event);
  if (eventbriteUrl) {
    return normalizeEventbriteEventUrl(eventbriteUrl) ?? eventbriteUrl.replace(/\/+$/, "");
  }

  if (event.source === "venunite") {
    const slug = venuniteSlugFromTags(event.tags);
    if (slug) {
      return buildVenuniteEventPublicUrl(slug);
    }
  }

  const raw = event.externalUrl?.trim() ?? event.ticketUrl?.trim();
  if (!raw?.startsWith("http")) {
    return null;
  }
  if (isEventbriteEventUrl(raw)) {
    return normalizeEventbriteEventUrl(raw) ?? raw.replace(/\/+$/, "");
  }
  try {
    const u = new URL(raw);
    u.hash = "";
    if (u.searchParams.get("format") === "ical") {
      u.search = "";
    }
    return u.href.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function hasPriceFromDetail(event: NormalizedEvent): boolean {
  return (
    event.isFree === true ||
    typeof event.priceMin === "number" ||
    Boolean(event.priceNotes?.trim())
  );
}

/** Sources that embed listing data in API but need HTML detail for price. */
export function sourceNeedsDetailBackfill(source: string): boolean {
  return source === "api:visitfresnocounty";
}

export function needsDetailBackfill(event: NormalizedEvent): boolean {
  if (!sourceNeedsDetailBackfill(event.source)) {
    return false;
  }
  const url = canonicalDetailPageUrl(event);
  if (!url) {
    return false;
  }
  return !hasPriceFromDetail(event);
}

export function resolveCandidateDetailFields(event: NormalizedEvent): {
  detail_status: CandidateDetailStatus;
  detail_page_url: string | null;
} {
  const detail_page_url = canonicalDetailPageUrl(event);

  if (needsDetailBackfill(event)) {
    return { detail_status: "pending", detail_page_url };
  }

  // Visit Fresno: detail phase is done once price is present — category comes from enrichment later.
  if (sourceNeedsDetailBackfill(event.source) && detail_page_url) {
    return { detail_status: "complete", detail_page_url };
  }

  // Other sources: detail_status tracks Visit Fresno HTML backfill only, not enrichment readiness.
  if (!sourceNeedsDetailBackfill(event.source)) {
    return { detail_status: "complete", detail_page_url };
  }

  const detail_status: CandidateDetailStatus = hasSufficientReviewData(event) ? "complete" : "pending";
  return { detail_status, detail_page_url };
}
