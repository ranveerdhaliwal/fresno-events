import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/tests/render";

import { EventShareCard } from "./EventShareCard";

describe("EventShareCard", () => {
  it("renders share actions", () => {
    renderWithProviders(<EventShareCard title="Jazz Night" url="https://example.com/event" />);

    expect(screen.getByTestId("event-share-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute("href", expect.stringContaining("twitter.com"));
  });

  it("shows copied state after successful clipboard write", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });

    renderWithProviders(<EventShareCard title="Jazz Night" url="https://example.com/event" />);
    await userEvent.click(screen.getByRole("button", { name: /Copy link/i }));

    expect(screen.getByRole("button", { name: /Copied!/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
