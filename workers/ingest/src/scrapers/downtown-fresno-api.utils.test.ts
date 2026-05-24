import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildDowntownWindows, parseDowntownFresnoHtml } from "./downtown-fresno-api.utils";

const fixturePath = join(
  process.cwd(),
  "../../tools/spikes/fixtures/downtown-fresno-sample.html"
);

describe("downtown-fresno-api.utils", () => {
  it("buildDowntownWindows returns 14-day chunks", () => {
    const windows = buildDowntownWindows(new Date("2026-05-23T12:00:00Z"), 14, 28);
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows[0]).toMatch(/^\d{2}-\d{2}-\d{2}-to-\d{2}-\d{2}-\d{2}$/);
  });

  it("parses HTML fixture into events", () => {
    const html = readFileSync(fixturePath, "utf8");
    const events = parseDowntownFresnoHtml(html, new Date("2026-05-23T12:00:00Z"));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.source).toBe("api:downtownfresno");
    expect(events[0]?.externalUrl).toContain("downtownfresno.org");
  });
});
