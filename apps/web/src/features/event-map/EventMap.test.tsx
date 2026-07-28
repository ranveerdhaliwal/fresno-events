import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

const flyTo = vi.fn();

vi.mock("@/lib/map-config", () => ({
  FRESNO_CENTER: { lat: 36.7378, lng: -119.7871 },
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png"
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="leaflet-marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ flyTo })
}));

vi.mock("./EventMapClusterGroup", () => ({
  EventMapClusterGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
    markerClusterGroup: vi.fn(() => ({
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      clearLayers: vi.fn()
    }))
  },
  icon: vi.fn(() => ({})),
  divIcon: vi.fn(() => ({})),
  markerClusterGroup: vi.fn(() => ({
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    clearLayers: vi.fn()
  }))
}));

import { EventMap } from "./EventMap";

describe("EventMap", () => {
  it("renders map with event markers", async () => {
    await renderWithSiteRouter(<EventMap items={getMockEventList()} />);

    expect(screen.getByTestId("leaflet-map")).toBeInTheDocument();
  });

  it("flies to the selected event venue", async () => {
    flyTo.mockClear();
    const items = getMockEventList().filter((item) => item.venue.lat != null && item.venue.lng != null);
    const selected = items[0];
    if (!selected) {
      throw new Error("Expected a mock event with coordinates");
    }

    await renderWithSiteRouter(<EventMap items={items} selectedId={selected.event.id} />);

    expect(flyTo).toHaveBeenCalledWith(
      [selected.venue.lat, selected.venue.lng],
      15,
      expect.objectContaining({ duration: expect.any(Number) })
    );
  });
});
