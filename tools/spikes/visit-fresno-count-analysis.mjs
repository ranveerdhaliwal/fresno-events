#!/usr/bin/env node
/**
 * Compare Visit Fresno API raw docs vs normalized vs batch-deduped counts.
 * Usage: node tools/spikes/visit-fresno-count-analysis.mjs
 */

import { dedupeScrapeBatch } from "../../workers/ingest/src/lib/scrape-batch-dedupe.utils.ts";
import {
  buildVisitFresnoDateRanges,
  buildVisitFresnoUrl,
  extractVisitFresnoDocs,
  resolveVisitFresnoApiToken,
  toNormalizedEvent,
  visitFresnoTotalCount
} from "../../workers/ingest/src/scrapers/visit-fresno-api.utils.ts";
import { VisitFresnoResponseSchema } from "../../workers/ingest/src/scrapers/visit-fresno-api.types.ts";

const USER_AGENT = "fresno-events-count-spike/1.0";

async function main() {
  const now = new Date();
  const token = await resolveVisitFresnoApiToken({ userAgent: USER_AGENT });
  if (!token) {
    console.error("Could not fetch Visit Fresno API token");
    process.exit(1);
  }

  const limit = 50;
  const ranges = buildVisitFresnoDateRanges(now);
  let rawDocs = 0;
  let nullMapped = 0;
  const events = [];
  const nullSamples = [];
  const errors = [];

  for (const range of ranges) {
    let skip = 0;
    let totalCount;

    for (let page = 0; page < 40; page++) {
      const url = buildVisitFresnoUrl({ token, skip, limit, range });
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) {
        errors.push({ range: `${range.start.toISOString().slice(0, 10)}..${range.end.toISOString().slice(0, 10)}`, status: response.status });
        break;
      }

      const parsed = VisitFresnoResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        errors.push({ range: "parse", message: parsed.error.message });
        break;
      }

      const docs = extractVisitFresnoDocs(parsed.data);
      totalCount = visitFresnoTotalCount(parsed.data) ?? totalCount;
      rawDocs += docs.length;

      for (const doc of docs) {
        const event = toNormalizedEvent(doc);
        if (event) {
          events.push(event);
        } else {
          nullMapped += 1;
          if (nullSamples.length < 10) {
            nullSamples.push({ title: doc.title, eventDate: doc.dates?.eventDate, startTime: doc.startTime, id: doc._id });
          }
        }
      }

      skip += limit;
      if (docs.length === 0 || (totalCount !== undefined && skip >= totalCount)) {
        break;
      }
    }
  }

  const bySourceId = new Map();
  for (const event of events) {
    bySourceId.set(`${event.source}:${event.sourceEventId}`, event);
  }

  const dedupe = await dedupeScrapeBatch(events);

  console.log(JSON.stringify({
    now: now.toISOString(),
    horizonDays: 30,
    weeklyRanges: ranges.length,
    rawDocs,
    normalized: events.length,
    uniqueBySourceEventId: bySourceId.size,
    afterBatchDedupe: dedupe.events.length,
    batchDuplicatesRemoved: dedupe.removed,
    nullMapped,
    errors,
    nullSamples,
    duplicateMatches: dedupe.duplicates.reduce((acc, item) => {
      acc[item.match] = (acc[item.match] ?? 0) + 1;
      return acc;
    }, {})
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
