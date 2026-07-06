import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@/features/admin-location/AdminLocationPicker", () => ({
  AdminLocationPicker: () => <div data-testid="admin-location-picker" />
}));

import { PublishedEventDetail } from "./PublishedEventDetail";

describe("PublishedEventDetail", () => {
  it("renders published event detail form", () => {
    const item = getMockEventList()[0]!;

    const detail = {
      event: item.event,
      venue: item.venue,
      ...(item.heroImage ? { heroImage: item.heroImage } : {})
    };

    renderWithProviders(
      <PublishedEventDetail
        token="test-token"
        detail={detail}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: item.event.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save priority/i })).toBeInTheDocument();
    expect(screen.getByTestId("admin-location-picker")).toBeInTheDocument();
  });
});
