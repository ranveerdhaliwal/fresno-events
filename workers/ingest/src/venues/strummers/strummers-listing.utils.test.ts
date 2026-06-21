import { describe, expect, it } from "vitest";

import { getPacificDateTimeParts } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

import configJson from "./venue.config.json";
import {
  parseStrummersEventStartTs,
  parseStrummersListingHtml,
  parseWallClock12hr
} from "./strummers-listing.utils";

const config = configJson as VenueConfig;

const STEVE_HOFSTETTER_CARD = `
<article class="eventlist-event eventlist-event--upcoming eventlist-event--hasimg">
  <a href="/shows/2026/2/19/steve-hofstetter" class="eventlist-column-thumbnail">
    <img class="eventlist-thumbnail" src="https://images.squarespace-cdn.com/example.jpg" alt="STEVE HOFSTETTER" />
  </a>
  <a href="/shows/2026/2/19/steve-hofstetter" class="eventlist-column-date">
    <div class="eventlist-datetag">
      <div class="eventlist-datetag-time"><span class="event-time-12hr">7:00\u202fPM</span></div>
    </div>
  </a>
  <div class="eventlist-column-info">
    <h1 class="eventlist-title"><a href="/shows/2026/2/19/steve-hofstetter" class="eventlist-title-link">STEVE HOFSTETTER</a></h1>
    <ul class="eventlist-meta">
      <li class="eventlist-meta-date">
        <time class="event-date" datetime="2026-12-03">Thursday, December 3, 2026</time>
      </li>
      <li class="eventlist-meta-time">
        <time class="event-time-12hr-start" datetime="2026-12-03">7:00\u202fPM</time>
        <time class="event-time-12hr-end" datetime="2026-12-03">11:30\u202fPM</time>
      </li>
      <li class="eventlist-meta-address">Strummers</li>
    </ul>
    <div class="eventlist-excerpt"><p>THURSDAY, DECEMBER 3, 7PM, 18+</p></div>
  </div>
</article>
`;

const ARIANA_MULTIDAY_CARD = `
<article class="eventlist-event eventlist-event--upcoming eventlist-event--hasimg eventlist-event--multiday">
  <a href="/shows/2026/8/7/ariana-grande-party" class="eventlist-column-thumbnail">
    <img class="eventlist-thumbnail" src="https://images.squarespace-cdn.com/example.jpg" alt="ARIANA GRANDE PARTY" />
  </a>
  <a href="/shows/2026/8/7/ariana-grande-party" class="eventlist-column-date">
    <div class="eventlist-datetag">
      <div class="eventlist-datetag-startdate eventlist-datetag-startdate--day">7</div>
      <div class="eventlist-datetag-enddate">to Aug 8</div>
    </div>
  </a>
  <div class="eventlist-column-info">
    <h1 class="eventlist-title"><a href="/shows/2026/8/7/ariana-grande-party" class="eventlist-title-link">ARIANA GRANDE PARTY</a></h1>
    <ul class="eventlist-meta">
      <li class="eventlist-meta-date">
        <time class="event-date" datetime="2026-08-07">Fri, Aug 7, 2026</time>
        <span class="eventlist-meta-time">
          <time class="event-time-12hr" datetime="2026-08-07">9:00\u202fPM</time>
        </span>
        <span class="event-datetime-divider"></span>
        <time class="event-date" datetime="2026-08-08">Sat, Aug 8, 2026</time>
        <span class="eventlist-meta-time">
          <time class="event-time-12hr" datetime="2026-08-08">1:30\u202fAM</time>
        </span>
      </li>
      <li class="eventlist-meta-address">Strummers</li>
    </ul>
  </div>
</article>
`;

describe("parseWallClock12hr", () => {
  it("parses narrow no-break space before meridiem", () => {
    expect(parseWallClock12hr("7:00\u202fPM")).toBe("19:00");
  });
});

describe("parseStrummersEventStartTs", () => {
  it("uses calendar date from markup, not URL path segments", () => {
    const iso = parseStrummersEventStartTs("2026-12-03", "7:00 PM");
    expect(iso).not.toBeNull();
    const pacific = getPacificDateTimeParts(new Date(iso!));
    expect(pacific.date).toBe("2026-12-03");
    expect(pacific.hour).toBe(19);
  });
});

describe("parseStrummersListingHtml", () => {
  it("extracts Squarespace eventlist cards", () => {
    const events = parseStrummersListingHtml(STEVE_HOFSTETTER_CARD, config);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("STEVE HOFSTETTER");
    expect(events[0]?.externalUrl).toBe("https://www.strummersclub.com/shows/2026/2/19/steve-hofstetter");
    expect(events[0]?.descriptionText).toContain("DECEMBER 3");
    const pacific = getPacificDateTimeParts(new Date(events[0]!.startTs));
    expect(pacific.date).toBe("2026-12-03");
    expect(pacific.hour).toBe(19);
  });

  it("parses multiday cards that use event-time-12hr instead of -start", () => {
    const events = parseStrummersListingHtml(ARIANA_MULTIDAY_CARD, config);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("ARIANA GRANDE PARTY");
    expect(events[0]?.externalUrl).toBe("https://www.strummersclub.com/shows/2026/8/7/ariana-grande-party");
    const start = getPacificDateTimeParts(new Date(events[0]!.startTs));
    expect(start.date).toBe("2026-08-07");
    expect(start.hour).toBe(21);
    const end = getPacificDateTimeParts(new Date(events[0]!.endTs!));
    expect(end.date).toBe("2026-08-08");
    expect(end.hour).toBe(1);
    expect(end.minute).toBe(30);
  });
});
