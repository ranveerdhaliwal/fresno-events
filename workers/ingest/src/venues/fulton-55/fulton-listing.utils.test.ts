import { describe, expect, it } from "vitest";

import configJson from "./venue.config.json";
import { getPacificDateTimeParts } from "@/lib/pacific-instant.utils";

import { parseFulton55ListingHtml, parseWfeaStartTs } from "./fulton-listing.utils";

const config = configJson;

const SAMPLE_HTML = `
<section class="wfea-venue venue">
  <article class="wfea-venue__event">
    <h2 class="wfea-venue__title entry-title">
      <a href="https://www.eventbrite.com/e/the-emo-night-tour-fresno-tickets-1990677683539">The Emo Night Tour – Fresno</a>
    </h2>
    <time class="wfea-venue__date-time" datetime="2026-06-27T20:00:00+00:00">June 27, 2026, 8:00 pm</time>
    <img class="wp-post-image" src="https://img.evbuc.com/example.jpg" alt="The Emo Night Tour" />
  </article>
  <article class="wfea-venue__event">
    <h2 class="wfea-venue__title entry-title">
      <a href="https://www.eventbrite.com/e/sweet-revenge-tickets-1988527146224">SWEET REVENGE</a>
    </h2>
    <time datetime="2026-08-01T19:30:00+00:00">August 1, 2026</time>
  </article>
</section>
`;

describe("parseWfeaStartTs", () => {
  it("treats WFEA datetime digits as Pacific local (not UTC)", () => {
    const iso = parseWfeaStartTs("2026-08-07T20:00:00+00:00");
    expect(iso).not.toBeNull();
    const pacific = getPacificDateTimeParts(new Date(iso!));
    expect(pacific.date).toBe("2026-08-07");
    expect(pacific.hour).toBe(20);
    expect(pacific.minute).toBe(0);
  });
});

describe("parseFulton55ListingHtml", () => {
  it("extracts events from WFEA listing cards", () => {
    const events = parseFulton55ListingHtml(SAMPLE_HTML, config);
    expect(events).toHaveLength(2);
    expect(events[0]?.title).toBe("The Emo Night Tour – Fresno");
    expect(events[0]?.source).toBe("scrape:fulton55.com");
    expect(events[0]?.venueName).toBe("Fulton 55");
    const emoPacific = getPacificDateTimeParts(new Date(events[0]!.startTs));
    expect(emoPacific.date).toBe("2026-06-27");
    expect(emoPacific.hour).toBe(20);
    expect(events[0]?.ticketUrl).toContain("eventbrite.com");
    expect(events[0]?.sourceEventId).toBe(events[0]?.ticketUrl);
    expect(events[1]?.title).toBe("SWEET REVENGE");
  });

  it("returns empty when no WFEA cards", () => {
    expect(parseFulton55ListingHtml("<html><body><p>No shows</p></body></html>", config)).toEqual([]);
  });
});
