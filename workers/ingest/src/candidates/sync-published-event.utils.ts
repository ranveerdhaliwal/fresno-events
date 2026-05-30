import type { NormalizedEvent } from "@fresno-events/shared";

export function buildPublishedEventPatchBody(
  normalized: NormalizedEvent,
  opts: { contentChanged: boolean; applyContentPatch: boolean },
  now: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    last_seen_at: now,
    updated_at: now
  };

  if (opts.applyContentPatch && opts.contentChanged) {
    body.title = normalized.title;
    body.start_ts = normalized.startTs;
    body.description_text = normalized.descriptionText ?? null;
    body.description_html = normalized.descriptionHtml ?? null;
    body.external_url = normalized.externalUrl ?? null;
    body.ticket_url = normalized.ticketUrl ?? null;
    if (normalized.endTs) {
      body.end_ts = normalized.endTs;
    }
    if (normalized.category) {
      body.category = normalized.category;
    }
  }

  return body;
}
