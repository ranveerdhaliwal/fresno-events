import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders pulse placeholder", () => {
    renderWithProviders(<Skeleton height={24} width="50%" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders nothing when not visible", () => {
    renderWithProviders(<Skeleton visible={false} />);
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });
});
