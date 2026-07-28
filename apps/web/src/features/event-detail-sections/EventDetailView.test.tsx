import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import type { EventDetailResult } from "@/services/events.types";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

vi.mock("@/lib/map-config", () => ({
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png"
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  ZoomControl: () => null
}));

vi.mock("leaflet", () => ({
  default: { icon: vi.fn(() => ({})), divIcon: vi.fn(() => ({})) },
  icon: vi.fn(() => ({})),
  divIcon: vi.fn(() => ({}))
}));

import { EventDetailView } from "./EventDetailView";

function mockDetail(): EventDetailResult {
  const item = getMockEventList()[0]!;
  return {
    detail: {
      event: item.event,
      venue: item.venue,
      galleryImages: [],
      relatedEvents: []
    },
    item,
    source: "mock",
    generatedAt: new Date().toISOString()
  };
}

describe("EventDetailView", () => {
  it("renders event title, hero, and preserves description line breaks", async () => {
    const data = mockDetail();
    data.detail.event.descriptionText = "Line one\n\nLine two";
    await renderWithSiteRouter(<EventDetailView data={data} />);

    expect(screen.getByTestId("event-detail-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: data.detail.event.title })).toBeInTheDocument();
    const description = document.querySelector("[class*='description']");
    expect(description?.textContent).toContain("Line one");
    expect(description?.textContent).toContain("Line two");
  });

  it("omits decorative section numbers but keeps series/day counts", async () => {
    const data = mockDetail();
    data.detail.event.category = "community";
    data.detail.event.tags = ["Art", "History"];
    data.detail.relatedEvents = [getMockEventList()[1]!].filter(Boolean);
    await renderWithSiteRouter(<EventDetailView data={data} />);

    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(screen.queryByText("03")).not.toBeInTheDocument();
    expect(screen.queryByText("04")).not.toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getAllByText("Community").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("event-tag").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
  });

  it("labels the original link section with source script", async () => {
    const data = mockDetail();
    await renderWithSiteRouter(<EventDetailView data={data} />);

    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("ORIGINAL LINK")).toBeInTheDocument();
  });

  it("renders source note without em dash when listing link exists", async () => {
    const data = mockDetail();
    data.detail.event.ticketUrl = "https://tickets.example.com/show";
    await renderWithSiteRouter(<EventDetailView data={data} />);

    expect(screen.getByText(/missed here, and to confirm/)).toBeInTheDocument();
    expect(screen.queryByText(/missed here —/)).not.toBeInTheDocument();
  });
});
