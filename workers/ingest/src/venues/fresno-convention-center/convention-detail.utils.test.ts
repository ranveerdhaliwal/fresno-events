import { describe, expect, it } from "vitest";

import { parseConventionDateTimeLine, parseConventionDetailPage } from "./convention-detail.utils";

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
});
