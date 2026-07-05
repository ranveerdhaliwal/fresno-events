import { describe, expect, it, vi } from "vitest";

import { normalizedEventToFormState } from "@/features/admin/admin-form.utils";
import { renderWithProviders, screen } from "@/tests/render";

import { AdminScheduleOptions } from "./AdminScheduleOptions";

const draft = normalizedEventToFormState(
  {
    source: "api:visitfresnocounty",
    sourceEventId: "evt-1",
    title: "Test Show",
    venueName: "Venue",
    startTs: "2026-05-23T12:00:00.000Z",
    venueCity: "Fresno"
  },
  5
);

describe("AdminScheduleOptions", () => {
  it("renders schedule options group", () => {
    renderWithProviders(<AdminScheduleOptions draft={draft} onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Schedule options" })).toBeInTheDocument();
    expect(screen.getByLabelText("All day")).toBeInTheDocument();
    expect(screen.getByLabelText("Time TBA")).toBeInTheDocument();
  });
});
