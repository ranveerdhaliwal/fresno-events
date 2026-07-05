import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { TokenGate } from "./TokenGate";

describe("TokenGate", () => {
  it("renders token entry form", () => {
    renderWithProviders(<TokenGate authError={null} onAuthenticate={() => undefined} />);
    expect(screen.getByText("Enter the review token")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect to review API/i })).toBeInTheDocument();
  });
});
