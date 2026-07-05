import { describe, expect, it } from "vitest";

import { dedupeEventsByContent, eventContentSignature } from "./event-dedupe.js";

const ringlingA = {
  event: { title: "Ringling Bros. And Barnum & Bailey", startTs: "2026-07-05T13:00:00.000-07:00" },
  venue: { name: "Save Mart Center" }
};

const ringlingB = {
  event: { title: "  Ringling Bros.  And Barnum & Bailey ", startTs: "2026-07-05T13:00:00.000-07:00" },
  venue: { name: "Save Mart Center" }
};

const otherEvent = {
  event: { title: "Garden Brothers Circus", startTs: "2026-07-05T19:00:00.000-07:00" },
  venue: { name: "Fresno Fairgrounds" }
};

describe("eventContentSignature", () => {
  it("normalizes title case/whitespace so duplicates collide", () => {
    expect(eventContentSignature(ringlingA)).toBe(eventContentSignature(ringlingB));
  });

  it("keeps different events distinct", () => {
    expect(eventContentSignature(ringlingA)).not.toBe(eventContentSignature(otherEvent));
  });

  it("treats a null venue name as empty", () => {
    const signature = eventContentSignature({ event: { title: "Show", startTs: "t" }, venue: { name: null } });
    expect(signature).toBe("show||t");
  });
});

describe("dedupeEventsByContent", () => {
  it("drops content duplicates, keeping the first", () => {
    const result = dedupeEventsByContent([ringlingA, ringlingB, otherEvent]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(ringlingA);
    expect(result[1]).toBe(otherEvent);
  });
});
