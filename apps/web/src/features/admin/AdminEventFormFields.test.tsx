import { describe, expect, it, vi } from "vitest";

import { useState } from "react";

import { normalizedEventToFormState } from "@/features/admin/admin-form.utils";
import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@/features/admin-location/AdminLocationPicker", () => ({
  AdminLocationPicker: () => <div data-testid="admin-location-picker" />
}));

import { AdminEventFormFields } from "./AdminEventFormFields";

function AdminEventFormFieldsHarness() {
  const [draft, setDraft] = useState(() =>
    normalizedEventToFormState(
      {
        source: "api:visitfresnocounty",
        sourceEventId: "evt-1",
        title: "Tower Art Hop",
        venueName: "Warnors Theatre",
        venueCity: "Fresno",
        startTs: "2026-05-22T20:00:00.000-07:00",
        category: "art"
      },
      3
    )
  );

  return (
    <AdminEventFormFields
      token="test-token"
      draft={draft}
      setDraft={setDraft}
      displayPriority={3}
      paletteKeySeed="cand-1"
    />
  );
}

describe("AdminEventFormFields", () => {
  it("renders admin event form fields", () => {
    renderWithProviders(<AdminEventFormFieldsHarness />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByTestId("admin-location-picker")).toBeInTheDocument();
  });
});
