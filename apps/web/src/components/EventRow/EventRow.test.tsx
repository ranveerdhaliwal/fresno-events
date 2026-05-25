import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { renderWithProviders, screen } from "@/tests/render";

import { EventRow } from "./EventRow";

describe("EventRow", () => {
  it("renders title and calls onSelect", async () => {
    const item = getMockEventList()[0]!;
    const event = toEventRowViewModel(item);
    const onSelect = vi.fn();

    renderWithProviders(<EventRow event={event} onSelect={onSelect} />);

    expect(screen.getByText(event.title)).toBeInTheDocument();
    await screen.getByTestId(`event-row-${event.slug}`).click();
    expect(onSelect).toHaveBeenCalled();
  });

  it("applies selected outline class", () => {
    const event = toEventRowViewModel(getMockEventList()[1]!);
    renderWithProviders(<EventRow event={event} isSelected onSelect={() => undefined} />);
    expect(screen.getByTestId(`event-row-${event.slug}`).className).toMatch(/selected/);
  });
});
