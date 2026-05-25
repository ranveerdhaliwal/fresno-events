import { describe, expect, it, vi } from "vitest";

import * as brClient from "@/browser-rendering/crawl-client";
import { renderUrlToMarkdown } from "@/browser-rendering/render-page";

vi.mock("@/browser-rendering/crawl-client", () => ({
  startCrawl: vi.fn(),
  getCrawlJob: vi.fn(),
  fetchAllRecords: vi.fn(),
  cancelCrawlJob: vi.fn()
}));

describe("renderUrlToMarkdown", () => {
  it("returns error when Cloudflare secrets missing", async () => {
    const result = await renderUrlToMarkdown({} as never, "https://example.com/event");
    expect(result).toEqual({
      error: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required."
    });
  });

  it("returns markdown when BR job completes", async () => {
    vi.mocked(brClient.startCrawl).mockResolvedValue("job-1");
    vi.mocked(brClient.getCrawlJob).mockResolvedValue({
      status: "completed",
      records: []
    } as never);
    vi.mocked(brClient.fetchAllRecords).mockResolvedValue([
      { status: "completed", url: "https://example.com", markdown: "# Event\n\nDetails here." }
    ] as never);

    const env = {
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok"
    };

    const result = await renderUrlToMarkdown(env as never, "https://example.com/event");
    expect(result).toEqual({ markdown: "# Event\n\nDetails here." });
  });
});
