import { describe, expect, it } from "vitest";

import {
  extractSaveMartTokenFromHtml,
  extractTicketmasterSlugDateYmd,
  parseSaveMartApiResponse,
  parseSaveMartSimpleToken,
  saveMartDocsToEvents,
  unwrapSaveMartTicketUrl
} from "./save-mart-api.utils";

describe("save-mart-api.utils", () => {
  it("parses plain-text get_simple_token response", () => {
    expect(parseSaveMartSimpleToken("a4955374af91167fa902bdec9153cd1d\n")).toBe(
      "a4955374af91167fa902bdec9153cd1d"
    );
  });

  it("extracts simpleToken from listing HTML", () => {
    const html = `fetch(xhr, { token: core.simpleToken }); const core = { simpleToken: "a4955374af91167fa902bdec9153cd1d" };`;
    expect(extractSaveMartTokenFromHtml(html)).toBe("a4955374af91167fa902bdec9153cd1d");
  });

  it("parses nested docs envelope from API", () => {
    const batch = parseSaveMartApiResponse({
      docs: { count: 1, docs: [{ recid: "1", title: "Show" }] }
    });
    expect(batch.docs).toHaveLength(1);
    expect(batch.count).toBe(1);
  });

  it("maps API docs to events with poster image and ticket URL", () => {
    const events = saveMartDocsToEvents([
      {
        recid: 99,
        title: "ZZ Top",
        date: { $date: "2026-08-07T07:00:00.000Z" },
        startTime: 1200,
        hostname: "Save Mart Center",
        url: "/event/zz-top/12345/",
        linkUrl: "https://www.ticketmaster.com/event/123",
        media_raw: [
          {
            mediaurl: "https://s1.ticketm.net/dam/a/dee/91a4e597-9d27-409c-be30-e28ebcaf8dee_RETINA_PORTRAIT_16_9.jpg"
          }
        ]
      }
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("ZZ Top");
    expect(events[0]?.imageUrl).toContain("ticketm.net");
    expect(events[0]?.ticketUrl).toContain("ticketmaster.com");
    expect(events[0]?.externalUrl).toBe("https://www.savemartcenter.com/event/zz-top/12345/");
    // startTime 1200 = 12:00 HHMM on API date
    expect(events[0]?.startTs).toBe("2026-08-07T19:00:00.000Z");
  });

  it("extracts performance date from ticketmaster affiliate slug over API date", () => {
    const affiliate =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fnate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026%2Fevent%2F1C00631A8DE414D4";
    expect(extractTicketmasterSlugDateYmd(affiliate)).toBe("2026-07-19");
    expect(unwrapSaveMartTicketUrl(affiliate)).toContain("nate-bargatze");

    const events = saveMartDocsToEvents([
      {
        recid: "nate",
        title: "Nate Bargatze: Big Dumb Eyes World Tour",
        date: { $date: "2026-07-20T07:00:00.000Z" },
        startTime: 1900,
        hostname: "Save Mart Center",
        linkUrl: affiliate
      }
    ]);

    expect(events).toHaveLength(1);
    // July 19 7pm Pacific — matches Ticketmaster, not Save Mart API date (July 20)
    expect(events[0]?.startTs).toBe("2026-07-20T02:00:00.000Z");
  });

  it("parses startTime as HHMM and as minutes since midnight", () => {
    const hhmm = saveMartDocsToEvents([
      {
        recid: "1",
        title: "Evening HHMM",
        date: { $date: "2026-08-01T07:00:00.000Z" },
        startTime: 1930,
        linkUrl: "https://www.ticketmaster.com/example-fresno-california-08-01-2026/event/abc"
      }
    ]);
    expect(hhmm[0]?.startTs).toBe("2026-08-02T02:30:00.000Z");

    const minutes = saveMartDocsToEvents([
      {
        recid: "2",
        title: "Evening minutes",
        date: { $date: "2026-08-01T07:00:00.000Z" },
        startTime: 1170,
        linkUrl: "https://www.ticketmaster.com/example-fresno-california-08-01-2026/event/def"
      }
    ]);
    expect(minutes[0]?.startTs).toBe("2026-08-02T02:30:00.000Z");
  });
});
