import type { PersistAuditSummary } from "@/candidates/persist-audit.utils";
import type { RunSummary } from "@/runner";

const MAX_SAMPLE_TITLES = 8;

/** Counts + short title sample for console JSON (full items stay in API responses / DB). */
export function compactPersistAuditForLog(summary: PersistAuditSummary): Record<string, unknown> {
  const compact: Record<string, unknown> = {
    new: summary.new,
    changed: summary.changed,
    unchanged: summary.unchanged
  };

  if (summary.batch_duplicates) {
    compact.batch_duplicates = summary.batch_duplicates;
  }

  if (summary.new > 0) {
    const titles = summary.new_items.map((item) => item.title);
    compact.new_titles = titles.slice(0, MAX_SAMPLE_TITLES);
    const omitted = titles.length - MAX_SAMPLE_TITLES;
    if (omitted > 0) {
      compact.new_titles_omitted = omitted;
    }
  }

  if (summary.changed > 0) {
    compact.changed_ids = summary.changed_items
      .slice(0, MAX_SAMPLE_TITLES)
      .map((item) => item.source_event_id);
    const omitted = summary.changed_items.length - MAX_SAMPLE_TITLES;
    if (omitted > 0) {
      compact.changed_ids_omitted = omitted;
    }
  }

  return compact;
}

export function compactRunSummaryForLog(summary: RunSummary): Record<string, unknown> {
  const { persist_preview, seed_metrics, ...rest } = summary;

  return {
    ...rest,
    ...(persist_preview ? { persist_preview: compactPersistAuditForLog(persist_preview) } : {}),
    ...(seed_metrics?.length
      ? {
          seed_metrics: seed_metrics.map((metric) => ({
            url: metric.url,
            label: metric.label,
            events_found: metric.events_found,
            venue_key: metric.venue_key,
            strategy: metric.strategy,
            ingest_lane: metric.ingest_lane,
            detail_mode: metric.detail_mode,
            ...(metric.event_links?.length ? { event_link_count: metric.event_links.length } : {}),
            ...(metric.detail_urls?.length ? { detail_url_count: metric.detail_urls.length } : {})
          }))
        }
      : {})
  };
}
