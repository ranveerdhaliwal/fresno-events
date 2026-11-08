import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./CalendarPage";
import { getCalendarMonth } from "@/services/events.service";

vi.mock("@/services/events.service", () => ({ getCalendarMonth: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/seo/useSeoHead", () => ({ useSeoHead: vi.fn() }));
vi.mock("@/components/PageChrome", () => ({ PageChrome: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/Button/Button", () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock("@/components/CalendarDayTile", () => ({ CalendarDayTile: ({ isoDate }: { isoDate: string }) => <div data-testid="calendar-date">{isoDate}</div> }));
vi.mock("@/components/CalendarMonthStrip", () => ({ CalendarMonthStrip: () => null }));
vi.mock("@/features/upcoming-events/UpcomingDetailPanel", () => ({ UpcomingDetailPanel: () => null }));
describe("calendar loading recovery", () => {
  it("shows a retryable failure instead of no-events tiles, then restores real dates", async () => {
    vi.mocked(getCalendarMonth).mockRejectedValue(new Error("Failed to fetch"));
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><CalendarPage year={2026} month={11} /></QueryClientProvider>);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("couldn't load events for November 2026");
    expect(screen.queryAllByTestId("calendar-date")).toHaveLength(0);
    expect(screen.queryByText("No events")).not.toBeInTheDocument();
    vi.mocked(getCalendarMonth).mockResolvedValue({ year: 2026, month: 11, days: [{ isoDate: "2026-11-30", total: 1, preview: [], hidden: 1 }], weeks: [], generatedAt: "2026-10-29T00:00:00Z", source: "api" });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByTestId("calendar-date")).toHaveTextContent("2026-11-30"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    client.clear();
  });
});
