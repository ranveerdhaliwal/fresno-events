import type { ScrapeResult } from "@fresno-events/shared";

import {
  VENUE_EVENT_SOURCE_WARN_THRESHOLDS,
  type SourceValidationProfile
} from "./source-profiles";

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ScrapeValidationResult {
  ok: boolean;
  hard: ValidationIssue[];
  soft: ValidationIssue[];
}

/** Bumped when validation semantics change; exposed on /health for stale-worker detection. */
export const INGEST_VALIDATION_POLICY = "recoverable_errors_soft_v2";

export interface ValidateScrapeOptions {
  /** When set, skip full-batch API source count warnings (single-venue promote/preflight). */
  venueFilter?: string[];
}

export function validateScrapeResult(
  result: ScrapeResult,
  profile: SourceValidationProfile | undefined,
  options: ValidateScrapeOptions = {}
): ScrapeValidationResult {
  const hard: ValidationIssue[] = [];
  const soft: ValidationIssue[] = [];

  const maxErrors = profile?.maxErrors ?? 0;
  const blockingErrors = result.errors.filter((error) => error.recoverable !== true);
  if (blockingErrors.length > maxErrors) {
    hard.push({
      code: "too_many_errors",
      message: `non-recoverable errors=${blockingErrors.length} exceeds maxErrors=${maxErrors}`
    });
  }

  const recoverableErrors = result.errors.length - blockingErrors.length;
  if (recoverableErrors > maxErrors && blockingErrors.length <= maxErrors) {
    soft.push({
      code: "many_recoverable_errors",
      message: `recoverable errors=${recoverableErrors} (detail-page failures; batch still persisted if validation passes)`
    });
  }

  const seenKeys = new Set<string>();
  for (const event of result.events) {
    if (!event.title?.trim()) {
      hard.push({ code: "missing_title", message: "event missing title" });
    }
    if (!event.venueName?.trim()) {
      hard.push({ code: "missing_venue", message: "event missing venueName" });
    }
    if (!event.startTs) {
      hard.push({ code: "missing_start_ts", message: "event missing startTs" });
    }
    if (!event.sourceEventId?.trim()) {
      hard.push({ code: "missing_source_event_id", message: "event missing sourceEventId" });
    }

    const dedupeKey = `${event.source}:${event.sourceEventId}`;
    if (seenKeys.has(dedupeKey)) {
      hard.push({
        code: "duplicate_source_event_id",
        message: `duplicate sourceEventId in batch: ${event.sourceEventId}`
      });
    }
    seenKeys.add(dedupeKey);

    if (profile?.eventSource && event.source !== profile.eventSource) {
      soft.push({
        code: "unexpected_event_source",
        message: `expected source ${profile.eventSource}, got ${event.source}`
      });
    }
  }

  if (profile?.multiSource && !options.venueFilter?.length) {
    const bySource = new Map<string, number>();
    for (const event of result.events) {
      bySource.set(event.source, (bySource.get(event.source) ?? 0) + 1);
    }
    for (const [source, min] of Object.entries(VENUE_EVENT_SOURCE_WARN_THRESHOLDS)) {
      const count = bySource.get(source) ?? 0;
      if (count < min) {
        soft.push({
          code: "low_event_count_by_source",
          message: `source=${source} events=${count} below min=${min}`
        });
      }
    }
  } else if (profile?.minEventsWarn !== undefined && result.events.length < profile.minEventsWarn) {
    soft.push({
      code: "low_event_count",
      message: `events=${result.events.length} below minEventsWarn=${profile.minEventsWarn}`
    });
  }

  return { ok: hard.length === 0, hard, soft };
}
