import { describe, expect, it } from "vitest";

import {
  dedupeEventsByContent,
  dedupeEventsByListingGroup,
  diversifyHomepageFeatured,
  eventContentSignature,
  eventListingGroupKey
} from "./event-dedupe.js";

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

const quakesJul21 = {
  event: {
    title: "Fresno Grizzlies vs Rancho Cucamonga Quakes",
    startTs: "2026-07-21T18:50:00.000-07:00",
    category: "sports"
  },
  venue: { name: "Chukchansi Park" }
};

const quakesJul22 = {
  event: {
    title: "Fresno Grizzlies vs Rancho Cucamonga Quakes",
    startTs: "2026-07-22T18:50:00.000-07:00",
    category: "sports"
  },
  venue: { name: "Chukchansi Park" }
};

const awayGame = {
  event: {
    title: "Fresno Grizzlies at Visalia Rawhide",
    startTs: "2026-07-19T18:00:00.000-07:00",
    category: "sports"
  },
  venue: { name: "Visalia" }
};

const comedy = {
  event: {
    title: "Nate Bargatze",
    startTs: "2026-07-19T20:00:00.000-07:00",
    category: "comedy"
  },
  venue: { name: "Save Mart Center" }
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

describe("eventListingGroupKey", () => {
  it("collapses same title+venue across different start times", () => {
    expect(eventListingGroupKey(quakesJul21)).toBe(eventListingGroupKey(quakesJul22));
  });

  it("prefers seriesId when present", () => {
    const a = {
      event: { title: "A", seriesId: "series:grizzlies:2026", category: "sports" },
      venue: { name: "Park" }
    };
    const b = {
      event: { title: "B different", seriesId: "series:grizzlies:2026", category: "sports" },
      venue: { name: "Other" }
    };
    expect(eventListingGroupKey(a)).toBe(eventListingGroupKey(b));
  });
});

describe("dedupeEventsByListingGroup", () => {
  it("keeps one night of a multi-game run", () => {
    const result = dedupeEventsByListingGroup([quakesJul21, quakesJul22, comedy]);
    expect(result.map((item) => item.event.title)).toEqual([
      "Fresno Grizzlies vs Rancho Cucamonga Quakes",
      "Nate Bargatze"
    ]);
  });
});

describe("diversifyHomepageFeatured", () => {
  it("allows at most one sports event and one listing group", () => {
    const result = diversifyHomepageFeatured([comedy, awayGame, quakesJul21, quakesJul22]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(comedy);
    expect(result[1]).toBe(awayGame);
  });
});
