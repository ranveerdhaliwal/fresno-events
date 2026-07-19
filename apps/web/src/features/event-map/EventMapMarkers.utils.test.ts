import { describe, expect, it } from "vitest";

import { escapeHtml } from "./EventMapMarkers.utils";

describe("escapeHtml", () => {
  it("escapes characters unsafe inside HTML attributes", () => {
    expect(escapeHtml(`Tower & Co <"Venue">`)).toBe("Tower &amp; Co &lt;&quot;Venue&quot;&gt;");
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });
});
