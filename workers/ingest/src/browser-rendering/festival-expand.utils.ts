import type { LineupEntry, NormalizedEvent } from "@fresno-events/shared";

import type { ParsedCrawlHints } from "@/browser-rendering/crawl-targets.utils";

/** Attach series metadata; ensure distinct source_event_id per day when multiple starts exist. */
export function applyFestivalMetadata(events: NormalizedEvent[], hints: ParsedCrawlHints): NormalizedEvent[] {
  const seriesId = hints.seriesId;
  if (!seriesId || hints.provider !== "festival") {
    return events;
  }

  const seriesName = seriesId.replace(/^series:/, "").replace(/:/g, " ") || "Festival";

  return events.map((event) => {
    const dayKey = event.startTs.slice(0, 10);
    return {
      ...event,
      seriesId,
      seriesName: event.seriesName ?? seriesName,
      category: event.category ?? "festival",
      sourceEventId: `${seriesId}:${dayKey}:${event.sourceEventId}`
    };
  });
}

export function lineupFromDescription(descriptionText: string | undefined): LineupEntry[] | undefined {
  if (!descriptionText?.trim()) {
    return undefined;
  }
  return [{ name: descriptionText.trim().slice(0, 500), role: "acts" }];
}
