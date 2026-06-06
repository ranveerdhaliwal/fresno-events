import type { NormalizedEvent } from "@fresno-events/shared";

import { hasSufficientReviewData } from "@/candidates/enrichment-candidate.utils";

export type CandidateDetailStatus = "complete" | "pending";

export function canonicalDetailPageUrl(event: NormalizedEvent): string | null {
  const raw = event.externalUrl?.trim() ?? event.ticketUrl?.trim();
  if (!raw?.startsWith("http")) {
    return null;
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
