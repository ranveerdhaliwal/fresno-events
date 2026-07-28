import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { getMockEventList } from "@/services/events.mock";
import { LIST_TICKET_PRICE_LABEL } from "@/lib/event-price.utils";
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

    expect(screen.getByText(`${event.timeLabel} - ${event.dateLabel}`)).toBeInTheDocument();
    expect(screen.getByText(event.venueName)).toBeInTheDocument();
    expect(screen.getByText(event.categoryLabel)).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders ticket price hint on one line with footer pinned below meta block", async () => {
    const base = getMockEventList()[0]!;
    const { priceMin: _min, priceMax: _max, isFree: _free, ...rest } = base.event;
    const event = toEventRowViewModel({
      ...base,
      event: {
        ...rest,
        isFree: false,
        ticketUrl: "https://tickets.example.com/show"
      }
    });

    await renderWithSiteRouter(<EventCard event={event} />);

    const ticketLabel = screen.getByText(LIST_TICKET_PRICE_LABEL);
    expect(ticketLabel.querySelector("br")).toBeNull();

    const card = screen.getByTestId(`event-card-${event.slug}`);
    const mainBlock = card.querySelector('[class*="mainBlock"]');
    const footerRow = card.querySelector('[class*="footerRow"]');
    expect(mainBlock).toBeInstanceOf(Element);
    expect(footerRow).toBeInstanceOf(Element);
    if (!(mainBlock instanceof Element) || !(footerRow instanceof Element)) {
      throw new Error("Expected EventCard mainBlock and footerRow");
    }
    expect(mainBlock.compareDocumentPosition(footerRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
