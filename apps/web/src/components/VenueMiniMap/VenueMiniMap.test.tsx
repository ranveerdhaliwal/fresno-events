import { describe, expect, it, vi } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";

vi.mock("@/lib/map-config", () => ({
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png"
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({}))
  },
  icon: vi.fn(() => ({})),
  divIcon: vi.fn(() => ({}))
}));

import { VenueMiniMap } from "./VenueMiniMap";

describe("VenueMiniMap", () => {
  it("renders map container", async () => {
    await renderWithSiteRouter(
      <VenueMiniMap lat={36.7378} lng={-119.7871} category="music" title="Jazz Night" tags={[]} subcategories={[]} />
    );

    expect(screen.getByTestId("leaflet-map")).toBeInTheDocument();
  });
});
