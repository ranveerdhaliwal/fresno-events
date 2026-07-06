import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { getMockEventList } from "@/services/events.mock";
import { toEventRowViewModel } from "@/lib/event-view-model";

import { UpcomingDetailPanel } from "./UpcomingDetailPanel";

describe("UpcomingDetailPanel", () => {
  it("renders empty state", async () => {
    await renderWithSiteRouter(<UpcomingDetailPanel event={null} />);
    expect(screen.getByTestId("upcoming-detail-empty")).toBeInTheDocument();
    expect(screen.getByText("SELECT AN EVENT")).toBeInTheDocument();
  });

  it("renders selected event", async () => {
    const event = toEventRowViewModel(getMockEventList()[0]!);
    await renderWithSiteRouter(<UpcomingDetailPanel event={event} />);
    expect(screen.getByTestId("upcoming-detail-panel")).toBeInTheDocument();
    expect(screen.getByText(event.title)).toBeInTheDocument();
  });
});
