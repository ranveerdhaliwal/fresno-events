// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { linkOccurrenceSiblings } from "@/routes/review-event.service";

const env = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
} as const;

describe("linkOccurrenceSiblings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not throw when PostgREST returns an empty body (Prefer: return=minimal)", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "http://127.0.0.1:54321/rest/v1/event_candidates?occurrence_id=eq.occ-1&id=neq.cand-primary"
      );
      expect(init?.method).toBe("PATCH");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Prefer: "return=minimal",
          "Content-Type": "application/json"
        })
      );

      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      linkOccurrenceSiblings(env, "occ-1", "event-1", "cand-primary")
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
