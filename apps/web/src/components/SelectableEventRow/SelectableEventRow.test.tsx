import { describe, expect, it, vi } from "vitest";

import { toEventRowViewModel } from "@/lib/event-view-model";
import { getMockEventList } from "@/services/events.mock";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { SelectableEventRow } from "./SelectableEventRow";

function firstRow() {
  const item = getMockEventList()[0];
  if (!item) {
    throw new Error("Expected at least one mock event.");
  }
  return toEventRowViewModel(item);
}

describe("SelectableEventRow", () => {
  it("renders an EventRow and companion EventCard when onSelect is provided", async () => {
    const row = firstRow();
    const onSelect = vi.fn();

    await renderWithSiteRouter(<SelectableEventRow event={row} onSelect={onSelect} />);

    expect(screen.getByTestId(`event-row-${row.slug}`)).toBeInTheDocument();
    expect(screen.getByTestId(`event-card-${row.slug}`)).toBeInTheDocument();
  });

  it("calls onSelect with the event id and slug when the row is activated", async () => {
    const row = firstRow();
    const onSelect = vi.fn();

    await renderWithSiteRouter(<SelectableEventRow event={row} onSelect={onSelect} />);

    screen.getByTestId(`event-row-${row.slug}`).click();

    expect(onSelect).toHaveBeenCalledWith(row.id, row.slug);
  });

  it("renders a companion EventCard when linkRows is set without onSelect", async () => {
    const row = firstRow();

    await renderWithSiteRouter(<SelectableEventRow event={row} linkRows />);

    expect(screen.getByTestId(`event-row-${row.slug}`)).toBeInTheDocument();
    expect(screen.getByTestId(`event-card-${row.slug}`)).toBeInTheDocument();
  });
});
