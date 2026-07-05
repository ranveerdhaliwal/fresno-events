import { describe, expect, it } from "vitest";

import { getEventRowLayoutFlags, getEventRowModifiers } from "./EventRow.utils";

describe("getEventRowLayoutFlags", () => {
  it("hides image for P5 unless showP5ListImage", () => {
    expect(
      getEventRowLayoutFlags({
        showImage: true,
        showP5ListImage: false,
        priority: 5
      })
    ).toEqual({ showRowImage: false, p5ListLayout: false });
  });

  it("shows P5 list image layout when enabled", () => {
    expect(
      getEventRowLayoutFlags({
        showImage: true,
        showP5ListImage: true,
        priority: 5,
        showVenueLogoInList: false
      })
    ).toEqual({ showRowImage: true, p5ListLayout: true });
  });

  it("shows venue logo for P1 regardless of priority threshold", () => {
    expect(
      getEventRowLayoutFlags({
        showImage: true,
        showP5ListImage: false,
        priority: 1,
        showVenueLogoInList: true
      }).showRowImage
    ).toBe(true);
  });
});

describe("getEventRowModifiers", () => {
  it("marks selected and live rows", () => {
    const modifiers = getEventRowModifiers({
      showImage: true,
      showP5ListImage: false,
      priority: 2,
      forceVisible: false,
      isSelected: true,
      isLive: true
    });

    expect(modifiers.p2).toBe(true);
    expect(modifiers.selected).toBe(true);
    expect(modifiers.live).toBe(true);
  });
});
