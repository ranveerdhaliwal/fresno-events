import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { AdminEditLink } from "./AdminEditLink";

const useCanAdminEdit = vi.fn(() => true);

vi.mock("./useCanAdminEdit", () => ({
  useCanAdminEdit: () => useCanAdminEdit()
}));

describe("AdminEditLink", () => {
  it("renders edit link when admin mode is enabled", async () => {
    useCanAdminEdit.mockReturnValue(true);
    await renderWithSiteRouter(<AdminEditLink eventId="event-123" />);

    expect(screen.getByRole("link", { name: /Edit/i })).toHaveAttribute("href", "/admin/events/event-123");
  });

  it("renders nothing when admin edit is disabled", async () => {
    useCanAdminEdit.mockReturnValue(false);
    await renderWithSiteRouter(<AdminEditLink eventId="event-123" />);
    expect(screen.queryByRole("link", { name: /Edit/i })).not.toBeInTheDocument();
  });
});
