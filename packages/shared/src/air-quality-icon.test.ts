import { describe, expect, it } from "vitest";

import { airQualityIconFor } from "./air-quality-icon.js";

describe("airQualityIconFor", () => {
  it("maps AQI bands to icons", () => {
    expect(airQualityIconFor(42, "Good")).toBe("🌿");
    expect(airQualityIconFor(55, "Moderate")).toBe("😷");
    expect(airQualityIconFor(120, "Unhealthy for Sensitive Groups")).toBe("😣");
  });
});
