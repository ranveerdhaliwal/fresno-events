import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { formStateToEventPatch, normalizedEventToFormState } from "./admin-form.utils";

const baseEvent: NormalizedEvent = {
  source: "api:visitfresnocounty",
  sourceEventId: "abc",
  title: "Test Show",
  venueName: "Venue",
  startTs: "2026-07-15T02:30:00.000Z",
  venueCity: "Fresno"
};

describe("normalizedEventToFormState", () => {
  it("decodes timed Pacific start", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    expect(form.startDate).toBe("2026-07-14");
    expect(form.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(form.startTime).not.toBe("");
  });

  it("decodes all-day UTC noon sentinel", () => {
    const form = normalizedEventToFormState(
      { ...baseEvent, startTs: "2026-05-23T12:00:00.000Z" },
      5
    );
    expect(form.startDate).toBe("2026-05-23");
    expect(form.startTime).toBe("");
  });
});

describe("formStateToEventPatch", () => {
  it("encodes all-day when start time empty", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    const patch = formStateToEventPatch(baseEvent, {
      ...form,
      startDate: "2026-08-01",
      startTime: ""
    });
    expect(patch.startTs).toBeDefined();
    expect(patch.timezone).toBe("America/Los_Angeles");
  });
});
