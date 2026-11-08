import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";

import { parseRainbowListingHtml } from "./rainbow-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

describe("current Rainbow Next listing", () => {
  function flight(records: unknown[]) {
    const payload = `5:${JSON.stringify(["$", "main", null, { children: ["$", "EventList", null, { initialEvents: records }] }])}\n`;
    // Exercise split Flight chunks and escaping through the real decoding path.
    const mid = Math.floor(payload.length / 2);
    return [payload.slice(0, mid), payload.slice(mid)]
      .map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`)
      .join("");
  }
  const base = {
    id: 5,
    title: 'Deathpact "Eclipsed"',
    slug: "eclipsed",
    eventDate: "2026-11-01T01:00:00.000Z",
    eventFlyer: "/api/media/file/flyer.jpeg",
    ticketUrl: "https://posh.vip/e/deathpact-fresno?t=rainbow",
    status: "published"
  };
  it("preserves UTC instants, imported Pacific dates, images and stable Eventmania IDs", () => {
    const events = parseRainbowListingHtml(
      flight([
        base,
        {
          ...base,
          id: "import-id",
          title: "DJ Pauly D",
          slug: "pauly",
          eventDate: "2027-01-09T20:00:00",
          ticketUrl: "https://eventmania.com/events/dj-pauly-d/1apB"
        }
      ]),
      config
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.startTs).toBe("2026-11-01T01:00:00.000Z");
    expect(events[0]?.imageUrl).toBe("https://www.rainbowballroom.com/api/media/file/flyer.jpeg");
    expect(events[1]?.startTs).toBe("2027-01-10T04:00:00.000Z");
    expect(events[1]?.sourceEventId).toBe("venue:rainbow-ballroom:1apB");
  });
  it("ignores drafts, invalid dates, untrusted ticket hosts and duplicate records", () => {
    const events = parseRainbowListingHtml(
      flight([
        base,
        base,
        { ...base, status: "draft" },
        { ...base, eventDate: "nonsense" },
        { ...base, ticketUrl: "https://posh.vip.evil.test/ticket" }
      ]),
      config
    );
    expect(events).toHaveLength(1);
  });
});

const SAMPLE = `
<div class="collection-list-blog-grid w-dyn-items">
  <div role="listitem" class="collection-item w-dyn-item">
    <a href="https://eventmania.com/events/legado-7-y-mas-fresno-ca-fresno-ca-2026-06-07/7mHo" class="image-item w-inline-block"><img class="image-grid" src="https://cdn.prod.website-files.com/6633b00ef9dc47b26b97d804/legado-banner.jpg" alt="" /></a>
    <div class="description-blog-post">
      <div class="data-categories">
        <div class="datatexdday">Fri</div><div class="datatexdday">Jun</div><div class="text-block-4">05</div>
      </div>
      <a href="https://eventmania.com/events/legado-7-y-mas-fresno-ca-fresno-ca-2026-06-07/7mHo" class="heading-blog-post">
        <h4 class="heading-blog-post">Legado 7 y mas</h4>
      </a>
    </div>
  </div>
  <div role="listitem" class="collection-item w-dyn-item">
    <a href="https://www.tixr.com/groups/acro/events/3ballmty-club-conexi-n-tour-fresno-ca-181572" class="image-item"></a>
    <div class="description-blog-post">
      <div class="data-categories">
        <div class="datatexdday">Fri</div><div class="datatexdday">Jun</div><div class="text-block-4">19</div>
      </div>
      <a href="https://www.tixr.com/groups/acro/events/3ballmty-club-conexi-n-tour-fresno-ca-181572" class="heading-blog-post">
        <h4 class="heading-blog-post">3BALLMTY | CLUB CONEXIÓN TOUR</h4>
      </a>
    </div>
  </div>
  <div role="listitem" class="collection-item w-dyn-item">
    <a href="https://www.eventbrite.com/e/1990357753620/preview/?aff=oddtdtcreator" class="image-item"></a>
    <div class="description-blog-post">
      <div class="data-categories">
        <div class="datatexdday">Sat</div><div class="datatexdday">Jun</div><div class="text-block-4">20</div>
      </div>
      <a href="https://www.eventbrite.com/e/1990357753620/preview/?aff=oddtdtcreator" class="heading-blog-post">
        <h4 class="heading-blog-post">TECHNO TAKEOVER - KROMI &amp; DREZO</h4>
      </a>
    </div>
  </div>
  <div role="listitem" class="collection-item w-dyn-item">
    <a href="https://ticketon.com/en/events/el-tri-alex-lora-fresno-ca-2026-08-13-kkpq0zpd5jwu" class="image-item"></a>
    <div class="description-blog-post">
      <div class="data-categories">
        <div class="datatexdday">Thu</div><div class="datatexdday">Aug</div><div class="text-block-4">13</div>
      </div>
      <a href="https://ticketon.com/en/events/el-tri-alex-lora-fresno-ca-2026-08-13-kkpq0zpd5jwu" class="heading-blog-post">
        <h4 class="heading-blog-post">El Tri Alex Lora</h4>
      </a>
    </div>
  </div>
</div>
`;

describe("parseRainbowListingHtml", () => {
  it("parses grid cards across ticket vendors and prefers card dates over URL drift", () => {
    const events = parseRainbowListingHtml(SAMPLE, config, new Date("2026-06-03T12:00:00Z"));
    expect(events).toHaveLength(4);

    const legado = events.find((e) => e.title.includes("Legado"));
    expect(legado?.startTs).toBe("2026-06-06T03:00:00.000Z");
    expect(legado?.ticketUrl).toContain("eventmania.com");
    expect(legado?.imageUrl).toContain("legado-banner.jpg");

    const tixr = events.find((e) => e.title.includes("3BALLMTY"));
    expect(tixr?.ticketUrl).toContain("tixr.com");
    expect(tixr?.startTs).toBe("2026-06-20T03:00:00.000Z");

    const eventbrite = events.find((e) => e.title.includes("TECHNO"));
    expect(eventbrite?.sourceEventId).toContain("1990357753620");

    const ticketon = events.find((e) => e.title.includes("El Tri"));
    expect(ticketon?.startTs).toBe("2026-08-14T03:00:00.000Z");
  });

  it("parses the full blog-grid snapshot (eventmania, tixr, eventbrite, ticketon)", () => {
    const html = readFileSync(join(__dirname, "fixtures/blog-grid.snapshot.html"), "utf8");
    const events = parseRainbowListingHtml(html, config, new Date("2026-06-03T12:00:00Z"));
    expect(events).toHaveLength(8);
    const titles = events.map((e) => e.title);
    expect(titles.some((t) => t.includes("3BALLMTY"))).toBe(true);
    expect(titles.some((t) => t.includes("TECHNO TAKEOVER"))).toBe(true);
    expect(titles.some((t) => t.includes("El Tri"))).toBe(true);
    expect(events.every((e) => e.imageUrl?.startsWith("http"))).toBe(true);
  });
});
