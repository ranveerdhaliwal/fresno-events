import { describe, expect, it } from "vitest";

import { buildEventSlug } from "@/routes/review/mappers.utils";
import { auditSlugCollisions } from "@/routes/review/slug-audit.utils";

describe("auditSlugCollisions", () => {
  it("does not collide with legacy date-only slugs when show time is included", () => {
    const title = "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth";
    const eveningSlug = buildEventSlug(title, "2026-07-06T00:00:00.000Z");

    const collisions = auditSlugCollisions(
      [{ id: "evening", title, startTs: "2026-07-06T00:00:00.000Z" }],
      ["ringling-bros-and-barnum-bailey-presents-the-greatest-show-on-earth-2026-07-05"]
    );

    expect(collisions).toHaveLength(0);
    expect(eveningSlug.endsWith("-2026-07-05-1700")).toBe(true);
  });

  it("flags pending peers that would share a slug", () => {
    const title = "Duplicate Night";
    const startTs = "2026-07-06T00:00:00.000Z";
    const slug = buildEventSlug(title, startTs);

    const collisions = auditSlugCollisions(
      [
        { id: "a", title, startTs },
        { id: "b", title, startTs }
      ],
      []
    );

    expect(collisions.some((row) => row.reason === "pending_peer" && row.candidateId === "b")).toBe(
      true
    );
    expect(collisions[0]?.slug).toBe(slug);
  });
});
