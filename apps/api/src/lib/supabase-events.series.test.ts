// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { listEventsFromSupabase } from "./supabase-events";
import { eventsRoute } from "@/routes/events";

const env = { SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "test-key" };
function game(index: number) {
  return {
    id: String(index), slug: `game-${index}`, title: `Game ${index}`,
    source: "api:milb", start_ts: "2027-04-03T02:00:00Z", category: "sports",
    status: "scheduled", venue_id: "park", series_id: "series:milb-grizzlies:2027",
    venue: { id: "park", name: "Chukchansi Park", city: "Fresno", lat: 36.7, lng: -119.8 }
  };
}
describe("complete parent series pagination", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("returns all 66 games across pages without dropping or duplicating the lookahead row", async () => {
    const games = Array.from({ length: 66 }, (_, i) => game(i));
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const params = new URL(input).searchParams;
      expect(params.get("series_id")).toBe("eq.series:milb-grizzlies:2027");
      expect(params.get("order")).toBe("start_ts.asc,id.asc");
      const offset = Number(params.get("offset"));
      return Response.json(games.slice(offset, offset + Number(params.get("limit"))));
    }));
    const options = { from: new Date("2026-10-24T00:00:00Z"), limit: 50, seriesId: "series:milb-grizzlies:2027" };
    const first = await listEventsFromSupabase(env as never, options);
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBe("50");
    const second = await listEventsFromSupabase(env as never, { ...options, seriesOffset: Number(first.nextCursor) });
    expect(second.items).toHaveLength(16);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(item => item.event.id)).size).toBe(66);
  });
  it("does not advertise another page when exactly 50 games remain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(Array.from({ length: 50 }, (_, i) => game(i)))));
    const result = await listEventsFromSupabase(env as never, { from: new Date(), limit: 50, seriesId: "season" });
    expect(result.nextCursor).toBeNull();
  });
  it("passes the HTTP cursor to the database and rejects malformed values before querying", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      expect(new URL(input).searchParams.get("offset")).toBe("50");
      return Response.json([game(50)]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await eventsRoute.request("https://app.test/?series_id=season&cursor=50", {}, env as never);
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { items: unknown[] } }).data.items).toHaveLength(1);
    const bad = await eventsRoute.request("https://app.test/?series_id=season&cursor=-1", {}, env as never);
    expect(bad.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
