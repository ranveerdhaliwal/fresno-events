import { describe, expect, it, vi } from "vitest";

import { resolveMediaUrl } from "@/lib/media-url";

describe("resolveMediaUrl", () => {
  it("prefixes relative paths with VITE_API_URL", () => {
    vi.stubEnv("VITE_API_URL", "http://127.0.0.1:8790");
    expect(resolveMediaUrl("/images/events/abc.jpg")).toBe("http://127.0.0.1:8790/images/events/abc.jpg");
    vi.unstubAllEnvs();
  });

  it("passes through absolute URLs", () => {
    const url = "https://assets.example.com/photo.jpg";
    expect(resolveMediaUrl(url)).toBe(url);
  });
});
