import { describe, expect, it } from "vitest";

import { parseConventionDateOnlyLine, parseConventionDateTimeLine, parseConventionDetailPage } from "./convention-detail.utils";

const SONIC = `
  <meta property="og:title" content="SONIC Live in Concert" />
  <meta property="og:description" content="Celebrate 35 years of Sonic the Hedgehog." />
  <meta property="og:image" content="https://assets.cdn.filesafe.space/sonic.jpg" />
  <h1>SONIC LIVE IN CONCERT</h1>
  <h2>FRI - OCT 2, 2026 - 8 PM</h2>
  <h2>Saroyan Theatre</h2>
  <a href="https://queue.atgtickets.com/?e=sonic">PURCHASE TICKETS HERE</a>
`;

describe("parseConventionDateTimeLine", () => {
  it("parses month abbrev and full month formats", () => {
    expect(parseConventionDateTimeLine("FRI - OCT 2, 2026 - 8 PM")).toEqual({
      dateYmd: "2026-10-02",
      timeHHmm: "20:00"
    });
    expect(parseConventionDateTimeLine("SAT, May 23, 2026 - 8PM")).toEqual({
      dateYmd: "2026-05-23",
      timeHHmm: "20:00"
    });
  });
});

describe("parseConventionDateOnlyLine", () => {
  it("parses date lines without show time", () => {
    expect(parseConventionDateOnlyLine("SAT - OCT 3, 2026")).toEqual({ dateYmd: "2026-10-03" });
  });
});

describe("parseConventionDetailPage", () => {
  it("extracts title, time, image, ticket URL, and detail page URL", () => {
    const detail = parseConventionDetailPage(
      SONIC,
      "https://events.fresnoconventioncenter.com/sonic-live-in-concert"
    );
    expect(detail?.title).toBe("SONIC Live in Concert");
    expect(detail?.startTs).toBe("2026-10-03T03:00:00.000Z");
    expect(detail?.externalUrl).toBe("https://events.fresnoconventioncenter.com/sonic-live-in-concert");
    expect(detail?.imageUrl).toContain("sonic.jpg");
    expect(detail?.ticketUrl).toContain("atgtickets.com");
    expect(detail?.descriptionText).toContain("Celebrate 35 years");
    expect(detail?.venueAddress).toBe("730 M St");
    expect(detail?.venueCity).toBe("Fresno");
  });

  it("keeps description and ticket URL when detail page omits show time", () => {
    const html = `
      <meta property="og:title" content="Ryan Castro – Sende The Last Dance – USA TOUR" />
      <meta property="og:description" content="Following the massive success of the first U.S. leg of his SENDÉ World Tour, which saw him headline iconic arenas." />
      <h1>RYAN CASTRO</h1>
      <h2>SAT - OCT 3, 2026</h2>
      <h2>SAROYAN THEATRE</h2>
      <a href="https://queue.atgtickets.com/?e=ryan">PURCHASE TICKETS HERE</a>
    `;
    const detail = parseConventionDetailPage(
      html,
      "https://events.fresnoconventioncenter.com/ryan-castro-sende-the-last-dance-usa-tour"
    );
    expect(detail?.startTs).toBeUndefined();
    expect(detail?.descriptionText).toContain("Following the massive success");
    expect(detail?.ticketUrl).toContain("atgtickets.com");
    expect(detail?.venueName).toBe("SAROYAN THEATRE");
  });
});
