import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { formatMonthLong } from "@/lib/event-time";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

import { UpcomingEvents } from "./UpcomingEvents";

const sample = getMockEventList()[0]!;

vi.mock("./useEventSections", () => ({
  useEventSections: () => ({
    data: {
      today: {
        preview: [sample],
        hidden: 0,
        total: 1,
        fromIso: "2026-07-28",
        untilIso: "2026-07-28"
      },
      week: {
        preview: [sample],
        hidden: 39,
        total: 40,
        fromIso: "2026-07-28",
        untilIso: "2026-08-03"
      },
      weekend: {
        preview: [],
        hidden: 0,
        total: 0,
        fromIso: "2026-08-01",
        untilIso: "2026-08-02"
      }
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

  it("renders a mustard view-all calendar button with the current month", async () => {
    await renderWithSiteRouter(<UpcomingEvents />);
    const month = formatMonthLong(new Date());
    expect(screen.getByRole("link", { name: `View Events all in ${month} →` })).toBeInTheDocument();
  });
});
