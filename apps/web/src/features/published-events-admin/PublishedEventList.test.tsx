import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { PublishedEventList } from "./PublishedEventList";

const publishedHit = {
  id: "evt-1",
  slug: "tower-art-hop",
  title: "Tower Art Hop",
  startTs: "2026-05-22T20:00:00.000-07:00",
  venueName: "Warnors Theatre",
  heroImageUrl: null,
  priority: 3,
  source: "api:visitfresnocounty",
  status: "scheduled"
};

describe("PublishedEventList", () => {
  it("renders empty state when there are no events", async () => {
    await renderWithSiteRouter(
      <PublishedEventList
        groups={[]}
        activeId={null}
        isLoading={false}
        onSelect={vi.fn()}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByText(/No published events in this range/i)).toBeInTheDocument();
  });

  it("renders skeleton rows while loading", async () => {
    await renderWithSiteRouter(
      <PublishedEventList
        groups={[]}
        activeId={null}
        isLoading={true}
        onSelect={vi.fn()}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByTestId("published-event-list-skeleton")).toBeInTheDocument();
  });

  it("renders published event rows", async () => {
    await renderWithSiteRouter(
      <PublishedEventList
        groups={[{ priority: 3, items: [publishedHit] }]}
        activeId={null}
        isLoading={false}
        onSelect={vi.fn()}
        selectedIds={new Set()}
        onToggleSelected={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByText("Tower Art Hop")).toBeInTheDocument();
    expect(screen.getByLabelText("Select all on page")).toBeInTheDocument();
  });
});
