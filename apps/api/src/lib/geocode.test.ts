// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveGoogleMapsPlatformApiKey } from "@/lib/google-maps-platform";

import { buildGeocodeQuery } from "./geocode";

describe("buildGeocodeQuery", () => {
  it("normalizes mailing-line address before query", () => {
    const query = buildGeocodeQuery({
      address: "2650 E. Shaw Ave, Fresno, CA 93710",
      city: "Fresno"
    });
    expect(query).toContain("2650");
    expect(query).toContain("Fresno");
    expect(query).toContain("CA");
  });

  it("returns null when empty", () => {
    expect(buildGeocodeQuery({ address: "", city: "" })).toBeNull();
  });
});

describe("resolveGoogleMapsPlatformApiKey", () => {
  it("trims key from env", () => {
    expect(resolveGoogleMapsPlatformApiKey({ GOOGLE_MAPS_PLATFORM_API_KEY: "  abc  " })).toBe("abc");
    expect(resolveGoogleMapsPlatformApiKey({})).toBeNull();
  });
});
