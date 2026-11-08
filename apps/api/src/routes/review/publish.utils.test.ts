// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventCandidate, NormalizedEvent } from "@fresno-events/shared";

vi.mock("@/lib/images", () => ({ registerSourceImage: vi.fn() }));
vi.mock("@/routes/review/event.service", () => ({
  getScheduledEventById: vi.fn(),
  getScheduledEventByOccurrenceId: vi.fn(),
  getScheduledEventByContentSignature: vi.fn(),
  patchApprovedEvent: vi.fn(),
  upsertEvent: vi.fn(),
  upsertVenue: vi.fn(),
  getPublishedEventForReview: vi.fn(),
  linkOccurrenceSiblings: vi.fn()
}));
import * as events from "@/routes/review/event.service";
import { publishCandidateToEvent } from "@/routes/review/publish.utils";

describe("reviewed update identity", () => {
  const normalized: NormalizedEvent = { source: "test", sourceEventId: "show", title: "Show", venueName: "Hall", startTs: "2026-11-02T03:00:00Z" };
  const candidate = { id: "candidate", occurrenceId: "new-occurrence", normalizedEvent: normalized } as EventCandidate;
  beforeEach(() => vi.resetAllMocks());

  it("updates the matched event when the corrected start no longer matches its occurrence", async () => {
    const existing = { id: "published", occurrence_id: "old-occurrence", start_ts: "2026-11-02T02:00:00Z", hero_image_id: "image" };
    vi.mocked(events.getScheduledEventById).mockResolvedValue(existing as never);
    vi.mocked(events.upsertVenue).mockResolvedValue({ id: "venue" } as never);
    vi.mocked(events.patchApprovedEvent).mockResolvedValue({ id: "published" } as never);
    const result = await publishCandidateToEvent({} as never, candidate, { existingEventId: "published", priority: 3, reviewedBy: "admin" });
    expect(result.event.id).toBe("published");
    expect(events.patchApprovedEvent).toHaveBeenCalledWith(expect.anything(), existing, candidate, normalized, "venue", null, 3, []);
    expect(events.getScheduledEventByOccurrenceId).not.toHaveBeenCalled();
    expect(events.getScheduledEventByContentSignature).not.toHaveBeenCalled();
    expect(events.upsertEvent).not.toHaveBeenCalled();
  });

  it("refuses an unavailable or cancelled matched event rather than inserting a replacement", async () => {
    vi.mocked(events.getScheduledEventById).mockResolvedValue(null);
    await expect(publishCandidateToEvent({} as never, candidate, { existingEventId: "missing", priority: 3, reviewedBy: "admin" })).rejects.toThrow("could not be found");
    expect(events.upsertVenue).not.toHaveBeenCalled();
    expect(events.upsertEvent).not.toHaveBeenCalled();
  });
});
