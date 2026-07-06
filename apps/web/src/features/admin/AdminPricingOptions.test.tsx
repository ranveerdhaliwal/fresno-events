import { describe, expect, it, vi } from "vitest";

import { normalizedEventToFormState } from "@/features/admin/admin-form.utils";
import { renderWithProviders, screen } from "@/tests/render";

import { AdminPricingOptions } from "./AdminPricingOptions";

const draft = normalizedEventToFormState(
  {
    source: "api:visitfresnocounty",
    sourceEventId: "evt-1",
    title: "Test Show",
    venueName: "Venue",
    startTs: "2026-07-15T02:30:00.000Z",
    venueCity: "Fresno"
  },
  5
);

describe("AdminPricingOptions", () => {
  it("renders pricing options group", () => {
    renderWithProviders(<AdminPricingOptions draft={draft} onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Pricing options" })).toBeInTheDocument();
    expect(screen.getByLabelText("Free event")).toBeInTheDocument();
  });
});
