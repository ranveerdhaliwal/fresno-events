import { describe, expect, it } from "vitest";

import {
  dedupeEventsByContent,
  dedupeEventsByListingGroup,
  diversifyHomepageFeatured,
  eventContentSignature,
  eventListingGroupKey,
  eventListingGroupKeys
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

const cinderellaNight1 = {
  event: {
    title: "CMT Presents Cinderella",
    startTs: "2026-07-31T19:30:00.000-07:00",
    seriesId: "series:cinderella:night-1",
    category: "community"
  },
  venue: { name: "Fresno Memorial Auditorium" }
};

const cinderellaNight2 = {
  event: {
    title: "CMT Presents Cinderella",
    startTs: "2026-08-01T19:30:00.000-07:00",
    seriesId: "series:cinderella:night-2",
    category: "community"
  },
  venue: { name: "Fresno Memorial Auditorium" }
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

  it("uses title+venue as the primary key even when seriesIds differ", () => {
    expect(eventListingGroupKey(cinderellaNight1)).toBe(eventListingGroupKey(cinderellaNight2));
    expect(eventListingGroupKeys(cinderellaNight1)).toContain("series:series:cinderella:night-1");
    expect(eventListingGroupKeys(cinderellaNight2)).toContain("series:series:cinderella:night-2");
  });

  it("still exposes a shared series key when seriesIds match", () => {
    const a = {
      event: { title: "A", seriesId: "series:grizzlies:2026", category: "sports" },
      venue: { name: "Park" }
    };
    const b = {
      event: { title: "B different", seriesId: "series:grizzlies:2026", category: "sports" },
      venue: { name: "Other" }
    };
    expect(eventListingGroupKeys(a)).toContain("series:series:grizzlies:2026");
    expect(eventListingGroupKeys(b)).toContain("series:series:grizzlies:2026");
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

  it("collapses multi-night shows with different seriesIds", () => {
    const result = dedupeEventsByListingGroup([cinderellaNight1, cinderellaNight2, comedy]);
    expect(result.map((item) => item.event.title)).toEqual(["CMT Presents Cinderella", "Nate Bargatze"]);
  });

  it("collapses differently titled siblings that share a seriesId", () => {
    const a = {
      event: { title: "Night 1", seriesId: "series:show", category: "music" },
      venue: { name: "A" }
    };
    const b = {
      event: { title: "Night 2", seriesId: "series:show", category: "music" },
      venue: { name: "B" }
    };
    const result = dedupeEventsByListingGroup([a, b, comedy]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
  });
});

describe("diversifyHomepageFeatured", () => {
  it("allows at most one sports event and one listing group", () => {
    const result = diversifyHomepageFeatured([comedy, awayGame, quakesJul21, quakesJul22]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(comedy);
    expect(result[1]).toBe(awayGame);
  });

  it("keeps one Cinderella night when seriesIds differ", () => {
    const result = diversifyHomepageFeatured([cinderellaNight1, cinderellaNight2, comedy]);
    expect(result.map((item) => item.event.title)).toEqual(["CMT Presents Cinderella", "Nate Bargatze"]);
  });

  it("keeps one Shakira night when both share a seriesId despite title/venue drift", () => {
    const early = {
      event: {
        title: "THE SHAKIRA EXPERIENCE plus Entre Nos",
        seriesId: "series:tower:shakira-experience-2026-08-01",
        category: "community"
      },
      venue: { name: "Tower Theatre for the Performing Arts" }
    };
    const late = {
      event: {
        title: "The Shakira Experience",
        seriesId: "series:tower:shakira-experience-2026-08-01",
        category: "music"
      },
      venue: { name: "Tower Theatre" }
    };
    const result = diversifyHomepageFeatured([early, late, comedy]);
    expect(result.map((item) => item.event.title)).toEqual([
      "THE SHAKIRA EXPERIENCE plus Entre Nos",
      "Nate Bargatze"
    ]);
  });
});
