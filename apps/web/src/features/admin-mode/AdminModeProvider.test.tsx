import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { AdminModeProvider, useAdminMode } from "./AdminModeProvider";

function AdminModeConsumer() {
  const { adminModeEnabled } = useAdminMode();
  return <span data-testid="admin-mode">{adminModeEnabled ? "on" : "off"}</span>;
}

describe("AdminModeProvider", () => {
  it("renders children with admin mode context", () => {
    renderWithProviders(
      <AdminModeProvider>
        <AdminModeConsumer />
      </AdminModeProvider>
    );

    expect(screen.getByTestId("admin-mode")).toBeInTheDocument();
  });
});
