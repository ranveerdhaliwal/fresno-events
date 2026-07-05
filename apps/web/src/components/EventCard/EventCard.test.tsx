import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { getMockEventList } from "@/services/events.mock";
import { toEventRowViewModel } from "@/lib/event-view-model";

import { EventCard } from "./EventCard";

describe("EventCard", () => {
  it("renders event title and links to detail", async () => {
    const event = toEventRowViewModel(getMockEventList()[0]!);

    await renderWithSiteRouter(<EventCard event={event} />);

    expect(screen.getByTestId(`event-card-${event.slug}`)).toBeInTheDocument();
    expect(screen.getByText(event.title)).toBeInTheDocument();
  });
});
