import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseMilbSchedule, toNormalizedEvents } from "./milb-api.utils";

const fixturePath = join(process.cwd(), "../../tools/spikes/fixtures/milb-sample.json");

describe("milb-api.utils", () => {
  it("maps fixture schedule to Grizzlies events", () => {
    const schedule = parseMilbSchedule(JSON.parse(readFileSync(fixturePath, "utf8")));
    const events = toNormalizedEvents(schedule);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.source).toBe("api:milb");
    expect(events[0]?.title).toContain("Fresno Grizzlies");
  });
});
