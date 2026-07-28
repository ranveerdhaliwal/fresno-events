// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatVenueAddressLine } from "./venue-display.utils";

describe("formatVenueAddressLine", () => {
  it("does not duplicate city when already in address", () => {
    const line = formatVenueAddressLine({
      address: "2650 E. Shaw Ave, Fresno, CA 93710",
      city: "Fresno"
    });
    expect(line).not.toMatch(/Fresno,\s*Fresno/);
    expect(line).toContain("2650");
  });

  it("drops trailing USA from display lines", () => {
    expect(
      formatVenueAddressLine({
        address: "2600 Fresno St, Fresno, CA 93721, USA",
        city: "Fresno"
      })
    ).not.toMatch(/USA/i);
  });
});
