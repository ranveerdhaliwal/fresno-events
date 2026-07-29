import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { SeeAllDayCta } from "./SeeAllDayCta";

describe("SeeAllDayCta", () => {
  it("links to day page with a human-readable count label", async () => {
    await renderWithSiteRouter(<SeeAllDayCta date="2026-06-10" count={4} />);

    const link = screen.getByTestId("see-all-day-cta");
    expect(link).toHaveTextContent("See all 4 events on Wed, Jun 10 →");
    expect(link).toHaveAttribute("href", "/day/2026-06-10");
  });
});
