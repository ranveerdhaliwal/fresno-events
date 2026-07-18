import { describe, expect, it, vi } from "vitest";

import type { Env } from "@/env";

vi.mock("@/routes/review/supabase.utils", () => ({
  supabaseReviewRequest: vi.fn()
}));

import { supabaseReviewRequest } from "@/routes/review/supabase.utils";
import { resolvePublishVenuePreview } from "./venue-preview.utils";

const env = {} as Env;

const baseEvent = {
  source: "ticketmaster" as const,
  sourceEventId: "tm-1",
  title: "Monster Jam",
  venueName: "Save Mart Center",
  startTs: "2026-08-22T02:00:00Z",
  venueAddress: "2650 East Shaw Ave."
};

describe("resolvePublishVenuePreview", () => {
  it("returns existing venue coords when candidate has none", async () => {
    vi.mocked(supabaseReviewRequest).mockReset();
    vi.mocked(supabaseReviewRequest).mockResolvedValue([
      { lat: 36.8096959, lng: -119.738519, name: "Save Mart Center" }
    ]);

    const preview = await resolvePublishVenuePreview(env, baseEvent);
    expect(preview).toEqual({
      lat: 36.8096959,
      lng: -119.738519,
      venueName: "Save Mart Center",
      venueSlug: "save-mart-center",
      source: "existing_venue"
    });
  });

  it("skips preview when candidate already has coords", async () => {
    vi.mocked(supabaseReviewRequest).mockReset();
    const preview = await resolvePublishVenuePreview(env, {
      ...baseEvent,
      venueLat: 36.8,
      venueLng: -119.7
    });
    expect(preview).toBeUndefined();
    expect(supabaseReviewRequest).not.toHaveBeenCalled();
  });

  it("skips preview when venue slug is missing coords in DB", async () => {
    vi.mocked(supabaseReviewRequest).mockReset();
    vi.mocked(supabaseReviewRequest).mockResolvedValue([{ lat: null, lng: null, name: "Unknown Venue" }]);

    const preview = await resolvePublishVenuePreview(env, {
      ...baseEvent,
      venueName: "Brand New Venue"
    });
    expect(preview).toBeUndefined();
  });

  it("falls back to an existing venue with the same street address", async () => {
    vi.mocked(supabaseReviewRequest).mockReset();
    vi.mocked(supabaseReviewRequest)
      .mockResolvedValueOnce([{ lat: null, lng: null, name: "Ernest E Valdez Hall" }])
      .mockResolvedValueOnce([
        { lat: 36.7329458, lng: -119.7827074, name: "William Saroyan Theatre Fresno Convention & Entertainment Center" }
      ]);

    const preview = await resolvePublishVenuePreview(env, {
      ...baseEvent,
      venueName: "Ernest E Valdez Hall at Fresno Convention & Entertainment Center",
      venueAddress: "700 M Street",
      venueCity: "Fresno"
    });

    expect(preview).toEqual({
      lat: 36.7329458,
      lng: -119.7827074,
      venueName: "William Saroyan Theatre Fresno Convention & Entertainment Center",
      venueSlug: "ernest-e-valdez-hall-at-fresno-convention-entertainment-center",
      source: "existing_venue"
    });
  });
});
