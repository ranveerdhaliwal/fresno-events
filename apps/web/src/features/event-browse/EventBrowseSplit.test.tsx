import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { getMockEventList } from "@/services/events.mock";
import { toEventRowViewModel } from "@/lib/event-view-model";

import { EventBrowseSplit } from "./EventBrowseSplit";

describe("EventBrowseSplit", () => {
  it("renders list rows and detail panel", async () => {
    const rows = getMockEventList()
      .slice(0, 2)
      .map((item) => toEventRowViewModel(item));

    await renderWithSiteRouter(
      <EventBrowseSplit rows={rows} selected={rows[0] ?? null} onSelect={() => undefined} />
    );

    expect(screen.getByTestId("event-browse-split")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-detail-panel")).toBeInTheDocument();
  });
});
