import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { AdSlot } from "./AdSlot";

describe("AdSlot", () => {
  it("renders placeholder banner by default", async () => {
    await renderWithSiteRouter(<AdSlot variant="banner-wide" />);
    expect(screen.getByTestId("ad-slot")).toBeInTheDocument();
    expect(screen.getByText("Reach Fresno locals")).toBeInTheDocument();
  });

  it("renders footer banner variant", async () => {
    await renderWithSiteRouter(<AdSlot variant="banner-footer" />);
    expect(screen.getByTestId("ad-slot")).toBeInTheDocument();
  });

  it("renders card variant", async () => {
    await renderWithSiteRouter(<AdSlot variant="card" />);
    expect(screen.getByTestId("ad-slot-card")).toBeInTheDocument();
  });

  it("renders side variant", async () => {
    await renderWithSiteRouter(<AdSlot variant="side" />);
    expect(screen.getByTestId("ad-slot-side")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /LEARN MORE/i })).toBeInTheDocument();
  });
});
