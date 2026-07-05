import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueries: () => [{ data: { items: [] }, isLoading: false }],
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
      error: null
    })
  };
});

import { SeriesLinkPanel } from "./SeriesLinkPanel";

const candidate = {
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
    category: "art",
    seriesName: "Art Hop Series"
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

describe("SeriesLinkPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders series link panel", () => {
    renderWithProviders(
      <SeriesLinkPanel
        token="test-token"
        candidate={candidate}
        seriesSiblings={[]}
        onSelectCandidate={vi.fn()}
        onSeriesUpdated={vi.fn()}
      />
    );

    expect(screen.getByText("Series")).toBeInTheDocument();
    expect(screen.getByText("Art Hop Series")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search title, venue, or URL")).toBeInTheDocument();
  });
});
