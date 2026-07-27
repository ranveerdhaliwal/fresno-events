import { describe, expect, it, vi } from "vitest";

import { toEventRowViewModel } from "@/lib/event-view-model";
import { getMockEventList } from "@/services/events.mock";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { AdminEventRow } from "./AdminEventRow";

function firstRow() {
  const item = getMockEventList()[0];
  if (!item) {
    throw new Error("Expected at least one mock event.");
  }
  return toEventRowViewModel(item);
}

describe("AdminEventRow", () => {
  it("renders the priority label and calls onSelect", async () => {
    const row = firstRow();
    const onSelect = vi.fn();

    await renderWithSiteRouter(
      <AdminEventRow event={row} onSelect={onSelect} priorityLabel="P3 · Notable" priceSubLabel="confidence" />
    );

    expect(screen.getByText("P3 · Notable")).toBeInTheDocument();
    expect(screen.getByText("confidence")).toBeInTheDocument();

    screen.getByTestId(`event-row-${row.slug}`).click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders an admin action element", async () => {
    const row = firstRow();

    await renderWithSiteRouter(
      <AdminEventRow event={row} adminAction={<span data-testid="admin-action">Edit</span>} />
    );

    expect(screen.getByTestId("admin-action")).toBeInTheDocument();
  });
});
