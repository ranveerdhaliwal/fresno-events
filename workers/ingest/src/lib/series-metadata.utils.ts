import type { NormalizedEvent } from "@fresno-events/shared";
import { computeCanonicalSeriesId, normalizeTitle, normalizeVenue } from "@fresno-events/shared";

function countListingRecIds(events: NormalizedEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const recid = event.seriesListingRecId?.trim();
    if (!recid) {
      continue;
    }
    const key = `${event.source}|${recid}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countTitleRuns(events: NormalizedEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.source}|${normalizeTitle(event.title)}|${normalizeVenue(event.venueName)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function applySeriesMetadata(events: NormalizedEvent[]): Promise<NormalizedEvent[]> {
  const recidCounts = countListingRecIds(events);
  const titleRunCounts = countTitleRuns(events);
  const results: NormalizedEvent[] = [];

  for (const event of events) {
    const recid = event.seriesListingRecId?.trim();
    const groupByListingRecId = recid
      ? (recidCounts.get(`${event.source}|${recid}`) ?? 0) > 1
      : false;
    const titleRunKey = `${event.source}|${normalizeTitle(event.title)}|${normalizeVenue(event.venueName)}`;
    const groupByTitleRun = !groupByListingRecId && (titleRunCounts.get(titleRunKey) ?? 0) > 1;

    const { seriesId } = await computeCanonicalSeriesId({
      source: event.source,
      title: event.title,
      venueName: event.venueName,
      ...(event.seriesId ? { seriesId: event.seriesId } : {}),
      ...(event.seriesName ? { seriesName: event.seriesName } : {}),
      ...(event.ticketUrl ? { ticketUrl: event.ticketUrl } : {}),
      ...(event.externalUrl ? { externalUrl: event.externalUrl } : {}),
      ...(recid && groupByListingRecId
        ? { seriesListingRecId: recid, groupByListingRecId: true }
        : {}),
      ...(groupByTitleRun ? { groupByTitleRun: true } : {})
    });
    results.push(seriesId ? { ...event, seriesId } : event);
  }
  return results;
}
