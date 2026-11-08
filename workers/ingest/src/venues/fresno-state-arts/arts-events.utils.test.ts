import { describe, expect, it } from "vitest";
import { parseCampusEvent, type CampusEvent } from "./arts-events.utils";

const now = new Date("2026-11-06T20:00:00Z");
const event: CampusEvent = {
  id: "recital", title: "Faculty Recital", status: "CONFIRMED",
  startDatetime: "2026-11-07T22:00", endDatetime: "2026-11-08T00:00",
  location: "Fresno State Concert Hall",
  locationDetail: { address: "2380 East Keats Avenue, Fresno, CA, USA" },
  tags: ["Music"], ticketOption: "PRICE_RANGE", ticketPriceMinimum: "15.00", ticketPriceMaximum: "20.00"
};

describe("campus public arts calendar", () => {
  it("reads the widget's UTC values once and preserves actual admission prices", () => {
    const result = parseCampusEvent(event, now)!;
    expect(result.startTs).toBe("2026-11-07T22:00:00.000Z");
    expect(result.endTs).toBe("2026-11-08T00:00:00.000Z");
    expect(result.priceMin).toBe(15);
    expect(result.priceMax).toBe(20);
    expect(result.isFree).toBeUndefined();
  });

  it("distinguishes recurring instances sharing one event ID", () => {
    const first = parseCampusEvent({ ...event, instanceId: "early" }, now)!;
    const second = parseCampusEvent({ ...event, instanceId: "late", startDatetime: "2026-11-08T02:00", endDatetime: "2026-11-08T04:00" }, now)!;
    expect(first.sourceEventId).not.toBe(second.sourceEventId);
    expect(first.externalUrl).not.toBe(second.externalUrl);
  });

  it("rejects internal sessions, online venues and exhibit ranges", () => {
    for (const change of [{ tags: ["Students"] }, { location: "Zoom" }, { endDatetime: "2026-11-30T00:00" }, { status: "CANCELLED" }]) {
      expect(parseCampusEvent({ ...event, ...change }, now)).toBeNull();
    }
  });
});
