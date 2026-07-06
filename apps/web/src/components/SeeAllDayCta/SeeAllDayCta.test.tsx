import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { SeeAllDayCta } from "./SeeAllDayCta";

describe("SeeAllDayCta", () => {
  it("links to day page with count label", async () => {
    await renderWithSiteRouter(<SeeAllDayCta date="2026-06-10" count={4} />);

    const link = screen.getByTestId("see-all-day-cta");
    expect(link).toHaveTextContent("SEE ALL 4 EVENTS ON 2026-06-10");
    expect(link).toHaveAttribute("href", "/day/2026-06-10");
  });
});
