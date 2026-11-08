import { afterEach, describe, expect, it, vi } from "vitest";
import { getCalendarMonth, listDayEvents, listSeriesEvents } from "./events.service";

describe("Pacific day event windows", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each([
    ["2026-11-01", "2026-11-01T07:00:00.000Z", "2026-11-02T08:00:00.000Z"],
    ["2026-11-30", "2026-11-30T08:00:00.000Z", "2026-12-01T08:00:00.000Z"]
  ])("requests the complete Pacific day %s", async (date, from, until) => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const fetchMock = vi.fn(async (_url: URL) => Response.json({ ok: true, data: { items: [], nextCursor: null, generatedAt: "2026-10-29T00:00:00Z" } }));
    vi.stubGlobal("fetch", fetchMock);
    await listDayEvents(date);
    const url = fetchMock.mock.calls[0]![0];
    expect(url.searchParams.get("from")).toBe(from);
    expect(url.searchParams.get("until")).toBe(until);
  });
});

describe("calendar availability", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each([403, 500, 503])("propagates HTTP %s instead of showing an empty mock calendar", async status => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status })));
    await expect(getCalendarMonth(2026, 11)).rejects.toThrow(String(status));
  });
  it("preserves network errors and cancellation", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const error = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(getCalendarMonth(2026, 11)).rejects.toBe(error);
    const cancelled = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cancelled));
    await expect(getCalendarMonth(2026, 11)).rejects.toBe(cancelled);
  });
  it("reports missing configuration instead of synthesizing dates", async () => {
    vi.stubEnv("VITE_API_URL", "");
    await expect(getCalendarMonth(2026, 11)).rejects.toThrow("not configured");
  });
  it("retains genuine empty API data", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const data = { year: 2026, month: 11, days: [{ isoDate: "2026-11-30", total: 0, preview: [], hidden: 0 }], weeks: [], generatedAt: "2026-10-29T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data })));
    expect(await getCalendarMonth(2026, 11)).toEqual({ ...data, source: "api" });
  });
});

describe("festival parent event listing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("loads every page of performances while preserving the parent filter", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        urls.push(url.href);
        return Response.json({
          ok: true,
          data: {
            items: [{ event: { id: urls.length } }],
            nextCursor: urls.length === 1 ? "next-page" : null,
            generatedAt: "2026-10-11T00:00:00Z"
          }
        });
      })
    );
    const result = await listSeriesEvents("series:bigfresnofair:2026");
    expect(result.items).toHaveLength(2);
    expect(result.source).toBe("api");
    expect(
      urls.every(
        (url) => new URL(url).searchParams.get("series_id") === "series:bigfresnofair:2026"
      )
    ).toBe(true);
    expect(new URL(urls[1]!).searchParams.get("cursor")).toBe("next-page");
  });
});
