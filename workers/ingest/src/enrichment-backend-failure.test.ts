import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichCandidate } from "@/ai";
import { runEnrichmentPipeline } from "./enrichment";

vi.mock("@/ai", () => ({
  getAiBackend: () => "gemini",
  enrichCandidate: vi.fn().mockResolvedValue(null)
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("enrichment backend failure", () => {
  it("stops after one failed model call and keeps candidates pending", async () => {
    const rows = ["first", "second"].map(id => ({
      id, status: "awaiting_enrichment", confidence_score: 0.7,
      normalized_event: { source: "scrape:example.test", sourceEventId: id, title: "A public concert", startTs: "2026-12-01T03:00:00Z", venueName: "Concert Hall" },
      review_notes: null, suggested_priority: null, detail_status: "complete", occurrence_id: null, canonical_candidate_id: null
    }));
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(init?.method ?? "GET");
      return new Response(JSON.stringify(rows), { status: 200 });
    }));
    const result = await runEnrichmentPipeline({}, { url: "https://database.example.test", serviceRoleKey: "test" }, { enrichAll: true });
    expect(result.processed).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.batches).toBe(1);
    expect(enrichCandidate).toHaveBeenCalledTimes(1);
    expect(requests.every(method => method === "GET")).toBe(true);
  });
});
