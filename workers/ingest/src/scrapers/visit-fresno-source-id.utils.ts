import { getPacificDateTimeParts } from "@/lib/pacific-instant.utils";
import type { VisitFresnoDoc } from "@/scrapers/visit-fresno-api.types";
import type { NormalizedEvent } from "@fresno-events/shared";

/**
 * Stable per-occurrence id: Visit Fresno rotates Mongo `_id` on CMS re-publishes, but
 * `recid` + Pacific show date identify the same Tuesday night reliably.
 */
export function buildVisitFresnoSourceEventId(
  raw: Pick<VisitFresnoDoc, "_id" | "recid">,
  startTs: string
): string {
  const recid = raw.recid?.trim();
  if (recid) {
    const parsed = new Date(startTs);
    if (!Number.isNaN(parsed.getTime())) {
      const { date } = getPacificDateTimeParts(parsed);
      if (date) {
        return `${recid}:${date}`;
      }
    }
  }
  return raw._id;
}

/** Secondary lookup when `source_event_id` was an ephemeral API `_id`. */
export function visitFresnoPersistAliasKey(event: NormalizedEvent): string | null {
  if (event.source !== "api:visitfresnocounty") {
    return null;
  }
  const recid = event.seriesListingRecId?.trim();
  if (!recid) {
    return null;
  }
  return `api:visitfresnocounty:rec:${recid}:${event.startTs}`;
}
