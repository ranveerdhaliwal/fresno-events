import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { buildPublishedEventPatchBody } from "./sync-published-event.utils";

const base: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Grizzlies vs Buzzers",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  endTs: "2026-06-01T05:00:00.000Z",
  descriptionText: "Home opener",
  category: "sports",
  ticketUrl: "https://tickets.example"
};

const now = "2026-05-24T12:00:00.000Z";

describe("buildPublishedEventPatchBody", () => {
  it("only bumps last_seen when content patch disabled", () => {
    expect(
      buildPublishedEventPatchBody(base, { contentChanged: true, applyContentPatch: false }, now)
    ).toEqual({
      last_seen_at: now,
      updated_at: now
    });
  });

  it("patches content when enabled and content changed", () => {
    expect(
      buildPublishedEventPatchBody(base, { contentChanged: true, applyContentPatch: true }, now)
    ).toEqual({
      last_seen_at: now,
      updated_at: now,
      title: base.title,
      start_ts: base.startTs,
      end_ts: base.endTs,
      description_text: base.descriptionText,
      description_html: null,
      external_url: null,
      ticket_url: base.ticketUrl,
      category: base.category
    });
  });

  it("skips content fields when fingerprint unchanged", () => {
    expect(
      buildPublishedEventPatchBody(base, { contentChanged: false, applyContentPatch: true }, now)
    ).toEqual({
      last_seen_at: now,
      updated_at: now
    });
  });
});
