import { describe, expect, it, vi } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { CandidateList } from "./CandidateList";

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

describe("CandidateList", () => {
  it("renders empty state when there are no candidates", async () => {
    await renderWithSiteRouter(
      <CandidateList
        groups={[]}
        activeId={null}
        isLoading={false}
        statusFilter="pending_review"
        onSelect={vi.fn()}
        selectedIds={new Set()}
        priorityOverrides={{}}
        seriesDisplayPriorities={new Map()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByText(/No candidates with status/i)).toBeInTheDocument();
  });

  it("renders skeleton rows while loading", async () => {
    await renderWithSiteRouter(
      <CandidateList
        groups={[]}
        activeId={null}
        isLoading={true}
        statusFilter="pending_review"
        onSelect={vi.fn()}
        selectedIds={new Set()}
        priorityOverrides={{}}
        seriesDisplayPriorities={new Map()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByTestId("candidate-list-skeleton")).toBeInTheDocument();
  });

  it("renders candidate rows", async () => {
    await renderWithSiteRouter(
      <CandidateList
        groups={[{ source: "api:visitfresnocounty", label: "Visit Fresno County", items: [baseCandidate] }]}
        activeId={null}
        isLoading={false}
        statusFilter="pending_review"
        onSelect={vi.fn()}
        selectedIds={new Set()}
        priorityOverrides={{}}
        seriesDisplayPriorities={new Map()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByText("Tower Art Hop")).toBeInTheDocument();
  });
});
