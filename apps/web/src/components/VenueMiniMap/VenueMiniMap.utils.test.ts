import { describe, expect, it } from "vitest";

import { buildEmojiMarkerHtml } from "./VenueMiniMap.utils";

describe("buildEmojiMarkerHtml", () => {
  it("wraps emoji in marker span", () => {
    expect(buildEmojiMarkerHtml("🎵")).toContain("🎵");
    expect(buildEmojiMarkerHtml("🎵")).toContain("font-size:22px");
  });
});
