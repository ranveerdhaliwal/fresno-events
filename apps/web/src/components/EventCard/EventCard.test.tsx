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
    // Title is not a heading — avoids heading-order a11y fails next to page h1/h2.
    expect(screen.getByText(event.title).tagName).toBe("SPAN");
  });

  it("renders a thumbnail beside the title", async () => {
    const event = toEventRowViewModel(getMockEventList()[0]!);

    await renderWithSiteRouter(<EventCard event={event} />);

    expect(screen.getByTestId(`event-card-thumb-${event.slug}`)).toBeInTheDocument();
  });

  it("renders date, venue pin, and category on separate lines", async () => {
    const event = toEventRowViewModel(getMockEventList()[0]!);

    await renderWithSiteRouter(<EventCard event={event} />);

    expect(screen.getByText(`${event.dayShort} ${event.dayNum}`.trim())).toBeInTheDocument();
    expect(screen.getByText(event.venueName)).toBeInTheDocument();
    expect(screen.getByText(event.categoryLabel)).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("labels ended events clearly", async () => {
    const base = getMockEventList()[0]!;
    const event = toEventRowViewModel(
      {
        ...base,
        event: {
          ...base.event,
          startTs: "2020-01-01T18:00:00.000Z",
          endTs: "2020-01-01T20:00:00.000Z"
        }
      },
      new Date("2026-07-18T20:00:00.000Z")
    );

    await renderWithSiteRouter(<EventCard event={event} />);

    expect(screen.getByText("ENDED")).toBeInTheDocument();
  });
});
