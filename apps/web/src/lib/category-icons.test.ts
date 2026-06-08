// @vitest-environment node
import { eventCategories } from "@fresno-events/shared";
import { describe, expect, it } from "vitest";

import { getCategoryEmoji } from "./category-icons";

describe("getCategoryEmoji", () => {
  it("returns an emoji for every category", () => {
    for (const category of eventCategories) {
      expect(getCategoryEmoji(category).length).toBeGreaterThan(0);
    }
  });

  it("falls back for unknown categories", () => {
    expect(getCategoryEmoji("unknown")).toBe("✨");
  });
});
