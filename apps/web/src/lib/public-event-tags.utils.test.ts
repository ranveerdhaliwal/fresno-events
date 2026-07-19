import { describe, expect, it } from "vitest";

import { filterPublicEventTags, isPublicEventTag, resolvePublicEventTags } from "./public-event-tags.utils";

describe("public-event-tags", () => {
  it("blocks source plumbing tags", () => {
    expect(isPublicEventTag("ticketmaster")).toBe(false);
    expect(isPublicEventTag("venunite_slug:foo")).toBe(false);
    expect(isPublicEventTag("upstream:module")).toBe(false);
  });

  it("keeps audience-facing labels", () => {
    expect(isPublicEventTag("Rock")).toBe(true);
    expect(isPublicEventTag("all ages")).toBe(true);
    expect(filterPublicEventTags(["Rock", "TICKETMASTER", "Classic Rock", "Rock"])).toEqual([
      "Rock",
      "Classic Rock"
    ]);
  });

  it("prefers subcategories then tags", () => {
    expect(
      resolvePublicEventTags({
        tags: ["ticketmaster", "live"],
        subcategories: ["Music", "Rock"]
      })
    ).toEqual(["Music", "Rock", "live"]);
  });
});
