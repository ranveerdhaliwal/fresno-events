import type { NormalizedEvent } from "@fresno-events/shared";
import { computeCanonicalSeriesId } from "@fresno-events/shared";

export async function applySeriesMetadata(events: NormalizedEvent[]): Promise<NormalizedEvent[]> {
  const results: NormalizedEvent[] = [];
  for (const event of events) {
    const { seriesId } = await computeCanonicalSeriesId({
      source: event.source,
      title: event.title,
      venueName: event.venueName,
      ...(event.seriesId ? { seriesId: event.seriesId } : {}),
      ...(event.seriesName ? { seriesName: event.seriesName } : {}),
      ...(event.ticketUrl ? { ticketUrl: event.ticketUrl } : {}),
      ...(event.externalUrl ? { externalUrl: event.externalUrl } : {})
    });
    results.push(seriesId ? { ...event, seriesId } : event);
  }
  return results;
}
