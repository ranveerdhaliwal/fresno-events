import { describe, expect, it, vi } from "vitest";

import { buildEventShareUrls, copyTextToClipboard } from "./EventShareCard.utils";

describe("buildEventShareUrls", () => {
  it("encodes title and url for share targets", () => {
    const urls = buildEventShareUrls("Jazz Night", "https://example.com/event");

    expect(urls.twitter).toContain(encodeURIComponent("https://example.com/event"));
    expect(urls.twitter).toContain(encodeURIComponent("Jazz Night"));
    expect(urls.facebook).toContain(encodeURIComponent("https://example.com/event"));
    expect(urls.sms).toContain(encodeURIComponent("Jazz Night"));
  });
});

describe("copyTextToClipboard", () => {
  it("returns true when clipboard write succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");

    vi.unstubAllGlobals();
  });

  it("returns false when clipboard write fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(false);

    vi.unstubAllGlobals();
  });
});
