import { describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { WeatherChip } from "./WeatherChip";

vi.mock("@/hooks/useLocalContext", () => ({
  useLocalContext: () => ({
    data: {
      weather: { ok: true, icon: "☀️", tempF: 82, condition: "Sunny" }
    }
  })
}));

describe("WeatherChip", () => {
  it("renders weather summary when available", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <WeatherChip />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("weather-chip")).toHaveTextContent("82°F");
    expect(screen.getByText(/Sunny/)).toBeInTheDocument();
  });
});
