// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCalendarMonth } from "./event-calendar";
import type { EventListItem } from "@fresno-events/shared";
import { listEventsFromSupabase } from "./supabase-events";

vi.mock("./supabase-events", () => ({ listEventsFromSupabase: vi.fn() }));
describe("complete calendar months", () => {
  afterEach(() => vi.resetAllMocks());
  const now = new Date("2026-10-29T16:00:00Z");
  it("includes late-month events when more than 200 events are published", async () => {
    const rows = Array.from({ length: 247 }, (_, i) => ({
      event: { id: `event-${i}`, title: `Event ${i}`, startTs: i < 200 ? "2026-11-01T20:00:00Z" : "2026-12-01T04:00:00Z", priority: 3, category: "community" },
      venue: { id: "venue", name: "Fresno venue" }
    } as EventListItem));
    vi.mocked(listEventsFromSupabase).mockImplementation(async (_env, options) => ({
      items: rows.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit),
      nextCursor: null, generatedAt: now.toISOString()
    }));
    const result = await resolveCalendarMonth({} as never, 2026, 11, now);
    expect(result.days).toHaveLength(42);
    expect(new Set(result.days.map(day => day.isoDate)).size).toBe(42);
    expect(result.days.find(day => day.isoDate === "2026-11-01")?.total).toBe(200);
    expect(result.days.find(day => day.isoDate === "2026-11-30")?.total).toBe(47);
    expect(listEventsFromSupabase).toHaveBeenCalledTimes(2);
    expect(listEventsFromSupabase).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ offset: 200, limit: 200 }));
    const window = vi.mocked(listEventsFromSupabase).mock.calls[0]![1];
    expect(window.from.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(window.until?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
  it("returns genuine empty days without duplicate dates", async () => {
    vi.mocked(listEventsFromSupabase).mockResolvedValue({ items: [], nextCursor: null, generatedAt: now.toISOString() });
    const result = await resolveCalendarMonth({} as never, 2026, 11, now);
    expect(result.days.every(day => day.total === 0)).toBe(true);
    expect(result.days.some(day => day.isoDate === "2026-11-30")).toBe(true);
    expect(new Set(result.days.map(day => day.isoDate)).size).toBe(42);
  });
  it("fails visibly if a later page cannot be loaded rather than returning a partial month", async () => {
    vi.mocked(listEventsFromSupabase).mockResolvedValueOnce({ items: Array(200).fill({}) as EventListItem[], nextCursor: null, generatedAt: now.toISOString() }).mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(resolveCalendarMonth({} as never, 2026, 11, now)).rejects.toThrow("Database unavailable");
  });
});
