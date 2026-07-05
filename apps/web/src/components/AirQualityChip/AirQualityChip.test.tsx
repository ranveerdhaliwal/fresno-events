import { describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { AirQualityChip } from "./AirQualityChip";

vi.mock("@/hooks/useLocalContext", () => ({
  useLocalContext: () => ({
    data: {
      airQuality: { ok: true, category: "Good", aqi: 42 }
    }
  })
}));

describe("AirQualityChip", () => {
  it("renders air quality summary when available", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AirQualityChip />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("air-quality-chip")).toHaveTextContent("Good");
    expect(screen.getByText(/42 AQI/)).toBeInTheDocument();
  });
});
