import { describe, expect, it } from "vitest";

import {
  buildVisitFresnoSourceEventId,
  visitFresnoPersistAliasKey
} from "./visit-fresno-source-id.utils";

describe("visit-fresno-source-id.utils", () => {
  it("builds recid:pacific-date when recid is present", () => {
    expect(
      buildVisitFresnoSourceEventId(
        { _id: "6a27eee1386e0d9464f79c8d", recid: "8739" },
        "2026-06-17T00:30:00.000Z"
      )
    ).toBe("8739:2026-06-16");
  });

  it("falls back to API _id when recid is missing", () => {
    expect(
      buildVisitFresnoSourceEventId({ _id: "6a107a9211371cf6eeb263af", recid: "" }, "2026-06-01T02:00:00.000Z")
    ).toBe("6a107a9211371cf6eeb263af");
  });

  it("builds persist alias from seriesListingRecId and startTs", () => {
    expect(
      visitFresnoPersistAliasKey({
        source: "api:visitfresnocounty",
        sourceEventId: "8739:2026-06-16",
        seriesListingRecId: "8739",
        title: "City of Fresno's Civic Academy",
        venueName: "City of Fresno Office of Community Affairs",
        startTs: "2026-06-17T00:30:00.000Z"
      })
    ).toBe("api:visitfresnocounty:rec:8739:2026-06-17T00:30:00.000Z");
  });
});
