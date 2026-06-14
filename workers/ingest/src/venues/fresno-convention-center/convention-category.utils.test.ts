import { describe, expect, it } from "vitest";

import { inferConventionCategory } from "./convention-category.utils";

describe("inferConventionCategory", () => {
  it("maps known FCC show types from title", () => {
    expect(inferConventionCategory("Absolute Combat Fighting")).toBe("sports");
    expect(inferConventionCategory("SONIC Live in Concert")).toBe("music");
    expect(inferConventionCategory("World Ballet Company: Swan Lake")).toBe("theater");
    expect(inferConventionCategory("Mrs. Doubtfire")).toBe("theater");
    expect(inferConventionCategory("Bluey's Big Play")).toBe("family");
    expect(inferConventionCategory("Miss California 2026")).toBe("family");
    expect(inferConventionCategory("Grupo Duelo - GRAVEDAD TOUR 2026")).toBe("music");
    expect(inferConventionCategory("Random Community Fair")).toBe("community");
  });
});
