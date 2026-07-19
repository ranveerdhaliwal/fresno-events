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

  it("opens a Fresno weather Google search in a new tab", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <WeatherChip />
      </QueryClientProvider>
    );

    const link = screen.getByRole("link", { name: /fresno weather/i });
    expect(link).toHaveAttribute("href", "https://www.google.com/search?q=fresno%20weather");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
