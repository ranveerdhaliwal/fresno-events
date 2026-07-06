import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("shows error message", () => {
    renderWithProviders(<ErrorBanner error={new Error("Network failed")} />);
    expect(screen.getByText("Network failed")).toBeInTheDocument();
    expect(screen.getByText("Request failed")).toBeInTheDocument();
  });
});
