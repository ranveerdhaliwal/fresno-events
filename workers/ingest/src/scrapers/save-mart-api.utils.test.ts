import { describe, expect, it } from "vitest";

import {
  extractSaveMartTokenFromHtml,
  parseSaveMartApiResponse,
  parseSaveMartSimpleToken,
  saveMartDocsToEvents
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
  });
});
