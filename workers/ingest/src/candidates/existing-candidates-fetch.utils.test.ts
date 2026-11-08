import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExistingCandidatesForSource } from "@/candidates";
const config = { url: "https://example.supabase.co", serviceRoleKey: "test" };
describe("existing candidate pagination", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("loads beyond the server's 1000-row cap and retains existing review metadata", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: `id-${i}`,
      source: "venunite",
      source_event_id: `vu:${i}`,
      status: "needs_changes",
      matched_event_id: `published-${i}`,
      normalized_event: {
        source: "venunite",
        sourceEventId: `vu:${i}`,
        title: "Show",
        venueName: "Venue",
        startTs: "2026-11-01T03:00:00Z",
        category: "music"
      }
    }));
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const parsed = new URL(url);
        urls.push(parsed);
        const offset = Number(parsed.searchParams.get("offset"));
        return Response.json(rows.slice(offset, offset + 1000));
      })
    );
    const result = await fetchExistingCandidatesForSource(config, "venunite");
    expect(result.size).toBe(1001);
    expect(result.get("venunite:vu:1000")?.matched_event_id).toBe("published-1000");
    expect(urls.map((u) => u.searchParams.get("offset"))).toEqual(["0", "1000"]);
    expect(urls.every((u) => u.searchParams.get("order") === "id.asc")).toBe(true);
  });
  it("stops persistence if existing review metadata cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );
    await expect(fetchExistingCandidatesForSource(config, "venunite")).rejects.toThrow("HTTP 503");
  });
});
