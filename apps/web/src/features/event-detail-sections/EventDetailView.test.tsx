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
  it("renders event title and hero", async () => {
    const data = mockDetail();
    await renderWithSiteRouter(<EventDetailView data={data} />);

    expect(screen.getByTestId("event-detail-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: data.detail.event.title })).toBeInTheDocument();
  });
});
