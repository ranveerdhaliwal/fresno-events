import { describe, expect, it } from "vitest";
import { resolveTowerShowTime } from "./show-time.utils";

describe("Tower doors and show times", () => {
  const event = { source: "scrape:towertheatre.ticketsauce.com", sourceEventId: "titus", title: "Titus", venueName: "Tower Theatre", startTs: "2026-10-25T02:00:00.000Z" };
  it("uses the explicit showtime on the same Pacific date", () => {
    expect(resolveTowerShowTime({ ...event, descriptionText: "7PM DOORS // 8PM SHOWTIME" })).toMatchObject({ startTs: "2026-10-25T03:00:00.000Z", doorsTs: "2026-10-25T02:00:00.000Z" });
    expect(resolveTowerShowTime({ ...event, startTs: "2027-02-18T02:00:00.000Z", descriptionText: "6PM DOORS // 7PM SHOWTIME" })).toMatchObject({ startTs: "2027-02-18T03:00:00.000Z", doorsTs: "2027-02-18T02:00:00.000Z" });
  });
  it("preserves dates without an explicit, valid doors/show pair", () => {
    expect(resolveTowerShowTime(event)).toBe(event);
    expect(resolveTowerShowTime({ ...event, descriptionText: "8PM DOORS // 7PM SHOWTIME" }).startTs).toBe(event.startTs);
    expect(resolveTowerShowTime({ ...event, descriptionText: "13PM DOORS // 8PM SHOWTIME" }).startTs).toBe(event.startTs);
  });
});
