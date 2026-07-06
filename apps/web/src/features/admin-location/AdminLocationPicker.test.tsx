import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@/lib/map-config", () => ({
  FRESNO_CENTER: { lat: 36.7378, lng: -119.7871 },
  MAP_TILE_ATTRIBUTION: "test",
  MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png"
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ setView: vi.fn() }),
  useMapEvents: () => null
}));

vi.mock("./useGeocodeVenue", () => ({
  useGeocodeVenue: () => ({
    mutate: vi.fn(),
    isPending: false
  }),
  geocodeErrorMessage: () => "Geocode failed."
}));

import { AdminLocationPicker } from "./AdminLocationPicker";

describe("AdminLocationPicker", () => {
  it("renders geocode toolbar and map", () => {
    renderWithProviders(
      <AdminLocationPicker
        token="test-token"
        lat="36.73780"
        lng="-119.78710"
        address="1800 Tulare St"
        city="Fresno"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Geocode from address" })).toBeInTheDocument();
    expect(screen.getByTestId("leaflet-map")).toBeInTheDocument();
  });
});
