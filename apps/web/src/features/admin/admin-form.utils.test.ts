// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { formStateToEventPatch, normalizedEventToFormState, changedAdminFormFieldsFromDraft } from "./admin-form.utils";

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
    expect(form.allDay).toBe(true);
    expect(form.timeTba).toBe(false);
  });

  it("decodes time TBA listings", () => {
    const form = normalizedEventToFormState(
      { ...baseEvent, startTs: "2026-05-23T12:00:00.000Z", timeUnknown: true },
      5
    );
    expect(form.startTime).toBe("");
    expect(form.allDay).toBe(false);
    expect(form.timeTba).toBe(true);
  });
});

describe("formStateToEventPatch", () => {
  it("encodes all-day when checkbox set", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    const patch = formStateToEventPatch(baseEvent, {
      ...form,
      startDate: "2026-08-01",
      startTime: "",
      allDay: true,
      timeTba: false
    });
    expect(patch.startTs).toBe("2026-08-01T12:00:00.000Z");
    expect(patch.timeUnknown).toBeUndefined();
  });

  it("encodes time TBA when checkbox set", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    const patch = formStateToEventPatch(baseEvent, {
      ...form,
      startDate: "2026-08-01",
      startTime: "",
      allDay: false,
      timeTba: true
    });
    expect(patch.startTs).toBe("2026-08-01T12:00:00.000Z");
    expect(patch.timeUnknown).toBe(true);
  });

  it("round-trips venue coordinates in patch", () => {
    const withCoords = { ...baseEvent, venueLat: 36.7378, venueLng: -119.7871 };
    const form = normalizedEventToFormState(withCoords, 5);
    expect(form.venueLat).toBe("36.73780");
    expect(form.venueLng).toBe("-119.78710");

    const patch = formStateToEventPatch(withCoords, {
      ...form,
      venueLat: "36.80000",
      venueLng: "-119.90000"
    });
    expect(patch.venueLat).toBe(36.8);
    expect(patch.venueLng).toBe(-119.9);
  });

  it("includes new price min and max in patch", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    const patch = formStateToEventPatch(baseEvent, {
      ...form,
      priceMin: "50",
      priceMax: "150"
    });
    expect(patch.priceMin).toBe(50);
    expect(patch.priceMax).toBe(150);
  });

  it("sets isFree and zero prices when Free is checked", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    const patch = formStateToEventPatch(baseEvent, {
      ...form,
      isFree: true,
      priceMin: "",
      priceMax: ""
    });
    expect(patch.isFree).toBe(true);
    expect(patch.priceMin).toBe(0);
    expect(patch.priceMax).toBe(0);
  });

  it("round-trips isFree from normalized event", () => {
    const event = { ...baseEvent, isFree: true };
    const form = normalizedEventToFormState(event, 5);
    expect(form.isFree).toBe(true);
    expect(formStateToEventPatch(event, form)).toEqual({});
  });

  it("returns an empty patch after round-trip through form state", () => {
    const form = normalizedEventToFormState(baseEvent, 5);
    expect(formStateToEventPatch(baseEvent, form)).toEqual({});
  });

  it("returns an empty patch for time TBA round-trip", () => {
    const event = { ...baseEvent, startTs: "2026-05-23T12:00:00.000Z", timeUnknown: true };
    const form = normalizedEventToFormState(event, 5);
    expect(formStateToEventPatch(event, form)).toEqual({});
  });

  it("tracks changed fields for priority and title edits", () => {
    const baseline = normalizedEventToFormState(baseEvent, 5);
    const draft = { ...baseline, priority: 2, title: "Renamed Show" };
    expect(changedAdminFormFieldsFromDraft(baseEvent, baseline, draft)).toEqual(
      new Set(["priority", "title"])
    );
  });
});
