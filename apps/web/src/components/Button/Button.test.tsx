import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/tests/render";

import { Button } from "./Button";

describe("Button", () => {
  it("renders native button and handles click", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button type="button" onClick={onClick}>
        Save
      </Button>
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders anchor when href is provided", () => {
    renderWithProviders(
      <Button href="https://example.com" variant="cta">
        Tickets
      </Button>
    );

    expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("href", "https://example.com");
  });
});
