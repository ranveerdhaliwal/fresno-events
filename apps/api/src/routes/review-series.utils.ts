import type { EventCandidate, SeriesSiblingCandidate } from "@fresno-events/shared";

export function toSeriesSiblingCandidate(row: EventCandidate): SeriesSiblingCandidate {
  return {
    id: row.id,
    source: row.source,
    sourceEventId: row.sourceEventId,
    title: row.normalizedEvent.title,
    startTs: row.normalizedEvent.startTs,
    venueName: row.normalizedEvent.venueName,
    status: row.status,
    ...(row.normalizedEvent.externalUrl ? { sourceUrl: row.normalizedEvent.externalUrl } : {})
  };
}
