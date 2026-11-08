// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  linkOccurrenceSiblings,
  upsertVenue,
  patchApprovedEvent
} from "@/routes/review/event.service";
import type { SupabaseEventRow } from "@/routes/review/types";
import type { EventCandidate, NormalizedEvent } from "@fresno-events/shared";

const env = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
} as const;

describe("linkOccurrenceSiblings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves stored Fair coordinates when the CMS supplies (0,0)", async () => {
    let posted: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posted = JSON.parse(String(init.body));
          return Response.json([{ id: "venue", ...posted }]);
        }
        return Response.json([{ lat: 36.729, lng: -119.747 }]);
      })
    );
    await upsertVenue(env, {
      source: "scrape:www.fresnofair.com",
      sourceEventId: "set",
      title: "Set",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-15T21:15:00Z",
      category: "festival",
      venueLat: 0,
      venueLng: 0
    });
    expect(posted.lat).toBe(36.729);
    expect(posted.lng).toBe(-119.747);
  });

  it("applies approved categories, prices, tags and parent series while preserving an existing image", async () => {
    let patched: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        patched = JSON.parse(String(init?.body));
        return Response.json([
          {
            id: "event",
            source: "scrape:www.fresnofair.com",
            source_refs: {},
            ...patched
          }
        ]);
      })
    );
    const normalized: NormalizedEvent = {
      source: "scrape:www.fresnofair.com",
      sourceEventId: "set",
      title: "Set",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-15T21:15:00Z",
      category: "music",
      priceMin: 25,
      doorsTs: "2026-10-15T20:15:00Z",
      tags: ["concert"],
      subcategories: ["rock"],
      seriesId: "series:bigfresnofair:2026",
      seriesName: "Big Fresno Fair"
    };
    await patchApprovedEvent(
      env,
      {
        id: "event",
        hero_image_id: "existing-image",
        source_refs: {}
      } as SupabaseEventRow,
      {
        id: "candidate",
        source: normalized.source,
        normalizedEvent: normalized,
        occurrenceId: "occ"
      } as EventCandidate,
      normalized,
      "venue",
      null,
      50,
      []
    );
    expect(patched).toMatchObject({
      category: "music",
      price_min: 25,
      doors_ts: "2026-10-15T20:15:00Z",
      price_max: null,
      tags: ["concert"],
      subcategories: ["rock"],
      series_id: "series:bigfresnofair:2026",
      series_name: "Big Fresno Fair",
      hero_image_id: "existing-image"
    });
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
