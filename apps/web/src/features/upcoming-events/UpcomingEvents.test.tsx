import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { UpcomingEvents } from "./UpcomingEvents";

const emptyBucket = {
  preview: [],
  hidden: 0,
  fromIso: "2026-06-10",
  untilIso: "2026-06-16"
};

vi.mock("./useEventSections", () => ({
  useEventSections: () => ({
    data: {
      today: emptyBucket,
      week: emptyBucket,
      weekend: emptyBucket
    },
    isLoading: false
  })
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

describe("UpcomingEvents", () => {
  it("renders upcoming events section", async () => {
    await renderWithSiteRouter(<UpcomingEvents />);
    expect(screen.getByTestId("upcoming-events")).toBeInTheDocument();
  });
});
