import { describe, expect, it } from "vitest";

import {
  currentSuggestedPriority,
  suggestEditorialPriority,
  type TriageCandidateRow
} from "@/routes/review/priority-triage.rules";

function row(patch: Partial<TriageCandidateRow>): TriageCandidateRow {
  return {
    id: "id-1",
    title: "Sample",
    venue_name: "Venue",
    source: "venunite",
    suggested_priority: 4,
    status: "pending_review",
    ...patch
  };
}

describe("priority-triage.rules", () => {
  it("Miss California pageant → P2", () => {
    expect(
      suggestEditorialPriority(
        row({ title: "Miss California's Teen 2026", venue_name: "William Saroyan Theatre" })
      )?.priority
    ).toBe(2);
  });

  it("Fresno Flea Market at Big Fresno Fair → P4", () => {
    expect(
      suggestEditorialPriority(
        row({
          title: "Fresno Flea Market",
          venue_name: "Big Fresno Fair",
          source: "scrape:www.fresnofair.com",
          suggested_priority: 1
        })
      )?.priority
    ).toBe(4);
  });

  it("delegates venue defaults (Save Mart Center → P2)", () => {
    expect(
      suggestEditorialPriority(
        row({ title: "Some Touring Band", venue_name: "Save Mart Center", source: "ticketmaster" })
      )?.priority
    ).toBe(2);
  });

  it("delegates recurring demotions (karaoke → P5)", () => {
    expect(
      suggestEditorialPriority(row({ title: "Saturday Night Karaoke Party", source: "api:visitfresnocounty" }))
        ?.priority
    ).toBe(5);
  });

  it("defaults missing suggested_priority to 5", () => {
    expect(currentSuggestedPriority(row({ suggested_priority: null }))).toBe(5);
  });
});
