import { describe, expect, it } from "vitest";

import { suggestEventPriority, type PriorityRuleInput } from "./priority-rules.js";

function input(patch: Partial<PriorityRuleInput> = {}): PriorityRuleInput {
  return {
    source: "venunite",
    title: "Sample Event",
    venueName: "Some Hall",
    ...patch
  };
}

describe("suggestEventPriority — editorial (promote)", () => {
  it("Ringling circus → P1", () => {
    const result = suggestEventPriority(
      input({ title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth" })
    );
    expect(result?.priority).toBe(1);
    expect(result?.kind).toBe("editorial");
  });

  it("Monster Jam at arena → P1", () => {
    expect(
      suggestEventPriority(input({ title: "Monster Jam", venueName: "Save Mart Center" }))?.priority
    ).toBe(1);
  });

  it("Ashanti at Big Fresno Fair → P2 (major headliner)", () => {
    expect(
      suggestEventPriority(
        input({
          source: "scrape:www.fresnofair.com",
          title: "R&B Night Out with Ashanti & Soul For Real",
          venueName: "Big Fresno Fair"
        })
      )?.priority
    ).toBe(2);
  });

  it("Nate Bargatze at Save Mart → P2", () => {
    expect(
      suggestEventPriority(
        input({ source: "ticketmaster", title: "Nate Bargatze: Big Dumb Eyes World Tour", venueName: "Save Mart Center" })
      )?.priority
    ).toBe(2);
  });

  it("Jamie Foxx → P2", () => {
    expect(suggestEventPriority(input({ source: "ticketmaster", title: "Jamie Foxx Live", venueName: "Save Mart Center" }))?.priority).toBe(2);
  });

  it("FIFA World Cup watch party → P3", () => {
    expect(
      suggestEventPriority(input({ title: "June 11th FIFA World Cup 2026 Watch Party", venueName: "Rainbow Ballroom" }))
        ?.priority
    ).toBe(3);
  });

  it("Miss California pageant → P2", () => {
    expect(
      suggestEventPriority(input({ title: "Miss California's Teen 2026", venueName: "William Saroyan Theatre" }))
        ?.priority
    ).toBe(2);
  });
});

describe("suggestEventPriority — venue/source defaults", () => {
  it("Save Mart Center show → P2 (even via ticketmaster source)", () => {
    expect(
      suggestEventPriority(input({ source: "ticketmaster", title: "Some Band", venueName: "Save Mart Center" }))
        ?.priority
    ).toBe(2);
  });

  it("MiLB Grizzlies → P3 with the legacy label", () => {
    const result = suggestEventPriority(
      input({ source: "api:milb", title: "Fresno Grizzlies vs Lake Elsinore Storm", venueName: "Chukchansi Park" })
    );
    expect(result?.priority).toBe(3);
    expect(result?.ruleLabel).toBe("Grizzlies / MiLB");
  });

  it("Tower Theatre → P3", () => {
    expect(
      suggestEventPriority(input({ source: "scrape:towertheatre.ticketsauce.com", title: "Indie Night" }))?.priority
    ).toBe(3);
  });

  it("Strummer's club show → P4 (notable, not default P5)", () => {
    expect(
      suggestEventPriority(input({ source: "scrape:strummersclub.com", title: "MELVINS" }))?.priority
    ).toBe(4);
  });

  it("Kansas at Big Fresno Fair → P3 (fair concert, not headliner tier)", () => {
    expect(
      suggestEventPriority(
        input({
          source: "scrape:www.fresnofair.com",
          title: "Kansas With Starship feat. Mickey Thomas",
          venueName: "Big Fresno Fair"
        })
      )?.priority
    ).toBe(3);
  });

  it("Seniors' Day at Big Fresno Fair → P4", () => {
    expect(
      suggestEventPriority(
        input({ source: "scrape:www.fresnofair.com", title: "Seniors' Day & Expo", venueName: "Big Fresno Fair" })
      )?.priority
    ).toBe(4);
  });

  it("Fresno Flea Market at Big Fresno Fair → P4", () => {
    expect(
      suggestEventPriority(
        input({ source: "scrape:www.fresnofair.com", title: "Fresno Flea Market", venueName: "Big Fresno Fair" })
      )?.priority
    ).toBe(4);
  });

  it("Fulton 55 show → P4", () => {
    expect(suggestEventPriority(input({ source: "scrape:fulton55.com", title: "Andre Nickatina" }))?.priority).toBe(4);
  });

  it("The Market on Kern → P4 (recurring downtown market)", () => {
    expect(
      suggestEventPriority(
        input({ source: "api:visitfresnocounty", title: "The Market on Kern", venueName: "Kern St between M and N Streets" })
      )?.priority
    ).toBe(4);
  });

  it("unknown source + unknown venue → null", () => {
    expect(
      suggestEventPriority(input({ source: "api:visitfresnocounty", title: "Concert", venueName: "Mystery Room" }))
    ).toBeNull();
  });
});

describe("suggestEventPriority — recurring (demote)", () => {
  it("farmers market → P5 even at a prominent source", () => {
    expect(
      suggestEventPriority(
        input({ source: "scrape:www.fresnofair.com", title: "Old Town Clovis Farmers Market" })
      )?.priority
    ).toBe(5);
  });

  it("recurring beats venue default (karaoke at Save Mart Center)", () => {
    expect(
      suggestEventPriority(input({ title: "Saturday Night Karaoke", venueName: "Save Mart Center" }))?.priority
    ).toBe(5);
  });

  it("Fresno Scavenger Hunt → P5", () => {
    expect(suggestEventPriority(input({ title: "Fresno Scavenger Hunt: Fresno Art & History" }))?.priority).toBe(5);
  });

  it("trivia / open mic / bingo / wine walk → P5", () => {
    expect(suggestEventPriority(input({ title: "Bar Trivia Night" }))?.priority).toBe(5);
    expect(suggestEventPriority(input({ title: "The Cobra Comedy Open Mic" }))?.priority).toBe(5);
    expect(suggestEventPriority(input({ title: "Last Day of School Bingo" }))?.priority).toBe(5);
    expect(suggestEventPriority(input({ title: "Old Town Clovis Wine Walk" }))?.priority).toBe(5);
  });

  it("Father's Day Run → P4 (community run)", () => {
    expect(suggestEventPriority(input({ title: "62nd Annual Father's Day Run" }))?.priority).toBe(4);
  });

  it("Juneteenth Freedom Run/Walk → P4", () => {
    expect(suggestEventPriority(input({ title: "Juneteenth Freedom Run/Walk" }))?.priority).toBe(4);
  });

  it("away minor-league baseball → P5, Grizzlies home not demoted", () => {
    expect(
      suggestEventPriority(
        input({ source: "ticketmaster", title: "Visalia Rawhide vs. Fresno Grizzlies", venueName: "Valley Strong Ballpark" })
      )?.priority
    ).toBe(5);
    expect(
      suggestEventPriority(
        input({ source: "ticketmaster", title: "Fresno Grizzlies vs. Stockton Ports", venueName: "Chukchansi Park" })
      )?.ruleId
    ).not.toBe("away-minor-league");
  });

  it("workshop / clinic / camp → P5", () => {
    expect(suggestEventPriority(input({ title: "Belmont Nursery's Herb Garden Workshop" }))?.priority).toBe(5);
    expect(suggestEventPriority(input({ title: "City of Fresno's Civic Academy" }))?.priority).toBe(5);
  });

  it("graduations / recognition ceremonies are routine venue rentals → P5 even at the arena", () => {
    expect(
      suggestEventPriority(
        input({ source: "ticketmaster", title: "Fresno Unified School District Graduations", venueName: "Save Mart Center" })
      )?.priority
    ).toBe(5);
    expect(
      suggestEventPriority(
        input({ source: "ticketmaster", title: "African American High School Recognition Ceremonies", venueName: "Save Mart Center" })
      )?.priority
    ).toBe(5);
  });

  it("film screenings → P4 even at a notable venue", () => {
    expect(
      suggestEventPriority(
        input({ source: "scrape:towertheatre.ticketsauce.com", title: "Hedwig and the Angry Inch Film Screening" })
      )?.priority
    ).toBe(4);
  });
});

describe("suggestEventPriority — guards", () => {
  it("never overrides Fresno State athletics (api:gobulldogs)", () => {
    expect(
      suggestEventPriority(
        input({ source: "api:gobulldogs", title: "Women's Volleyball: Red vs. Blue Scrimmage", venueName: "Save Mart Center" })
      )
    ).toBeNull();
  });

  it("Ticketmaster Bulldogs volleyball at Save Mart → P4 (not arena default P2)", () => {
    expect(
      suggestEventPriority(
        input({
          source: "ticketmaster",
          title: "Fresno State Bulldogs Womens Volleyball vs. UC Irvine Anteaters",
          venueName: "Save Mart Center"
        })
      )?.priority
    ).toBe(4);
  });

  it("Ticketmaster Bulldogs football → P3", () => {
    expect(
      suggestEventPriority(
        input({
          source: "ticketmaster",
          title: "Fresno State Bulldogs Football vs. San Diego State",
          venueName: "Save Mart Center"
        })
      )?.priority
    ).toBe(3);
  });
});
