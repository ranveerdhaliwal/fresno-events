import { describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { AirQualityChip } from "./AirQualityChip";

vi.mock("@/hooks/useLocalContext", () => ({
  useLocalContext: () => ({
    data: {
      airQuality: { ok: true, category: "Good", aqi: 42, icon: "🌿" }
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
    expect(screen.getByTestId("air-quality-chip")).toHaveTextContent("42 AQI");
    expect(screen.getByTestId("air-quality-chip")).toHaveTextContent("🌿");
  });

  it("opens a Fresno air quality Google search in a new tab", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AirQualityChip />
      </QueryClientProvider>
    );

    const link = screen.getByRole("link", { name: /fresno air quality/i });
    expect(link).toHaveAttribute("href", "https://www.google.com/search?q=fresno%20air%20quality");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
