import { describe, expect, it, vi } from "vitest";

import { getMockEventList } from "@/services/events.mock";
import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

vi.mock("@/lib/map-config", () => ({
  FRESNO_CENTER: { lat: 36.7378, lng: -119.7871 },
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png"
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="leaflet-marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn(() => ({}))
  },
  divIcon: vi.fn(() => ({}))
}));

import { EventMap } from "./EventMap";

describe("EventMap", () => {
  it("renders map with event markers", async () => {
    await renderWithSiteRouter(<EventMap items={getMockEventList()} />);

    expect(screen.getByTestId("leaflet-map")).toBeInTheDocument();
  });
});
