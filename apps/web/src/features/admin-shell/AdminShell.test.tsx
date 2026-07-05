import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { AdminShell } from "./AdminShell";

vi.mock("@/features/admin-mode/AdminModeProvider", () => ({
  useAdminMode: () => ({
    adminModeEnabled: true,
    toggleAdminMode: vi.fn()
  })
}));

describe("AdminShell", () => {
  it("renders admin navigation tabs", async () => {
    await renderWithSiteRouter(<AdminShell />, { initialPath: "/admin" });

    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live events" })).toBeInTheDocument();
  });
});
