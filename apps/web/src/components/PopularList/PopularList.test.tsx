import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { PopularList } from "./PopularList";

describe("PopularList", () => {
  it("renders title and event rows", async () => {
    await renderWithSiteRouter(
      <PopularList
        title="POPULAR TODAY"
        count={1}
        events={[
          {
            rank: 1,
            id: "e1",
            slug: "jazz-night",
            title: "Jazz Night",
            meta: "8 PM · Tioga",
            priceLabel: "$20"
          }
        ]}
      />
    );

    expect(screen.getByTestId("popular-list")).toBeInTheDocument();
    expect(screen.getByText("POPULAR TODAY")).toBeInTheDocument();
    expect(screen.getByText("Jazz Night")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Jazz Night/i })).toHaveAttribute("href", "/event/jazz-night");
  });
});
