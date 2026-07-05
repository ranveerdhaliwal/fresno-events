import { describe, expect, it } from "vitest";

import { formatErrorBannerContent } from "./ErrorBanner.utils";

describe("formatErrorBannerContent", () => {
  it("reads Error message", () => {
    expect(formatErrorBannerContent(new Error("boom"))).toEqual({ message: "boom" });
  });

  it("falls back for unknown errors", () => {
    expect(formatErrorBannerContent("nope")).toEqual({ message: "Something went wrong." });
  });

  it("includes HTTP status when present", () => {
    expect(formatErrorBannerContent({ status: 503, message: "down" })).toEqual({
      message: "Something went wrong.",
      status: 503
    });
  });
});
