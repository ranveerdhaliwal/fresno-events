import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  contentFingerprint,
  fingerprintChanged,
  resolveStatusOnRescrape,
  type ExistingCandidateRow
} from "./content-fingerprint.utils";

const baseEvent: NormalizedEvent = {
  source: "api:milb",
  sourceEventId: "game-1",
  title: "Grizzlies vs Buzzers",
  venueName: "Chukchansi Park",
  startTs: "2026-06-01T02:00:00.000Z",
  category: "sports"
};

describe("content-fingerprint.utils", () => {
  it("resolveStatusOnRescrape keeps status when fingerprint unchanged", () => {
    const existing: ExistingCandidateRow = {
      id: "c1",
      source: "api:milb",
      source_event_id: "game-1",
      status: "approved",
      content_fingerprint: "abc",
      matched_event_id: "e1",
      reviewed_at: null,
      reviewed_by: null
    };
    expect(resolveStatusOnRescrape(existing, "abc")).toBe("approved");
  });

  it("resolveStatusOnRescrape sets needs_changes when approved and content changed", () => {
    const existing: ExistingCandidateRow = {
      id: "c1",
      source: "api:milb",
      source_event_id: "game-1",
      status: "approved",
      content_fingerprint: "old",
      matched_event_id: "e1",
      reviewed_at: null,
      reviewed_by: null
    };
    expect(resolveStatusOnRescrape(existing, "new")).toBe("needs_changes");
  });

  it("fingerprintChanged detects delta", () => {
    expect(fingerprintChanged(undefined, "x")).toBe(true);
    expect(
      fingerprintChanged(
        {
          id: "1",
          source: "api:milb",
          source_event_id: "a",
          status: "pending_review",
          content_fingerprint: "same",
          matched_event_id: null,
          reviewed_at: null,
          reviewed_by: null
        },
        "same"
      )
    ).toBe(false);
  });

  it("contentFingerprint is stable for same payload", async () => {
    const a = await contentFingerprint(baseEvent);
    const b = await contentFingerprint({ ...baseEvent });
    expect(a).toBe(b);
    const c = await contentFingerprint({ ...baseEvent, title: "Different title" });
    expect(c).not.toBe(a);
  });
});
