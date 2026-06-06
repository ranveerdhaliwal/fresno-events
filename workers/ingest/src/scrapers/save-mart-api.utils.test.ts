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

  it("maps API docs to events", () => {
    const events = saveMartDocsToEvents([
      {
        recid: 99,
        title: "ZZ Top",
        date: { $date: "2026-08-07T07:00:00.000Z" },
        startTime: 1200,
        location: "Save Mart Center",
        url: "/event/zz-top/12345/"
      }
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("ZZ Top");
  });
});
