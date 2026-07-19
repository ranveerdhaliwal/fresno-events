import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

vi.mock("@/lib/map-config", () => ({
  FRESNO_CENTER: { lat: 36.7378, lng: -119.7871 },
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png",
  patchLeafletMarkerIcons: vi.fn()
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({}))
  },
  icon: vi.fn(() => ({})),
  divIcon: vi.fn(() => ({}))
}));

vi.mock("react-leaflet", () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="leaflet-marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("./EventMapClusterGroup", () => ({
  EventMapClusterGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import { groupEventsByVenue } from "./EventMap.utils";
import { EventMapMarkers } from "./EventMapMarkers";

describe("EventMapMarkers", () => {
  it("renders venue markers with event links", async () => {
    const groups = groupEventsByVenue(getMockEventList());

    await renderWithSiteRouter(<EventMapMarkers groups={groups} />);

    expect(screen.getAllByTestId("leaflet-marker").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Tower Art Hop Afterglow/i })).toBeInTheDocument();
  });
});
