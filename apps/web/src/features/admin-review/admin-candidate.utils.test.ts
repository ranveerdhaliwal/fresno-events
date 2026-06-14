// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { toCandidateEventRowViewModel, resolveCandidateListingUrl, resolveCandidateTicketUrl } from "./admin-candidate.utils";

const baseCandidate = {
  id: "cand-1",
  source: "api:visitfresnocounty",
  sourceEventId: "evt-1",
  title: "Tower Art Hop",
  venueName: "Warnors Theatre",
  startTs: "2026-05-22T20:00:00.000-07:00",
  normalizedEvent: {
    source: "api:visitfresnocounty",
    sourceEventId: "evt-1",
    title: "Tower Art Hop",
    venueName: "Warnors Theatre",
    venueCity: "Fresno",
    startTs: "2026-05-22T20:00:00.000-07:00",
    category: "art"
  },
  rawPayload: {},
  dedupeHash: "abc",
  confidenceScore: 0.87,
  suggestedPriority: 1,
  status: "pending_review",
  detailStatus: "complete",
  occurrenceId: "occ-1",
  createdAt: "2026-04-25T08:00:00.000Z",
  updatedAt: "2026-04-25T08:00:00.000Z"
} satisfies EventCandidate;

describe("toCandidateEventRowViewModel", () => {
  it("maps priority and confidence to row props", () => {
    const row = toCandidateEventRowViewModel(baseCandidate, 1);
    expect(row.priority).toBe(1);
    expect(row.priceLabel).toBe("87%");
    expect(row.flagLabel).toBeNull();
    expect(row.categoryLabel).toBe("visitfresnocounty");
  });
});

describe("resolveCandidateListingUrl", () => {
  it("prefers normalized external URL over scrape metadata", () => {
    const candidate = {
      ...baseCandidate,
      sourceUrl: "https://www.fresnofair.com/",
      normalizedEvent: {
        ...baseCandidate.normalizedEvent,
        externalUrl: "https://www.fresnofair.com/events/2026/kansas-starship-mickey"
      }
    } satisfies EventCandidate;

    expect(resolveCandidateListingUrl(candidate)).toBe(
      "https://www.fresnofair.com/events/2026/kansas-starship-mickey"
    );
  });
});

describe("resolveCandidateTicketUrl", () => {
  it("returns ticket URL when different from listing URL", () => {
    const candidate = {
      ...baseCandidate,
      normalizedEvent: {
        ...baseCandidate.normalizedEvent,
        externalUrl: "https://www.fresnofair.com/events/2026/kansas-starship-mickey",
        ticketUrl: "https://etix.example.com/tickets/123"
      }
    } satisfies EventCandidate;

    expect(resolveCandidateTicketUrl(candidate)).toBe("https://etix.example.com/tickets/123");
  });

  it("returns null when ticket URL matches listing URL", () => {
    const url = "https://www.fresnofair.com/events/2026/kansas-starship-mickey";
    const candidate = {
      ...baseCandidate,
      normalizedEvent: {
        ...baseCandidate.normalizedEvent,
        externalUrl: url,
        ticketUrl: url
      }
    } satisfies EventCandidate;

    expect(resolveCandidateTicketUrl(candidate)).toBeNull();
  });
});
