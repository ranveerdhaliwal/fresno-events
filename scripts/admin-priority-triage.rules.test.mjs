import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { currentSuggestedPriority, suggestEditorialPriority } from "./admin-priority-triage.rules.mjs";

/** @param {Partial<import('./admin-priority-triage.rules.mjs').TriageCandidateRow>} patch */
function row(patch) {
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

describe("suggestEditorialPriority", () => {
  it("Miss California pageant → P2", () => {
    const result = suggestEditorialPriority(
      row({ title: "Miss California's Teen 2026", venue_name: "William Saroyan Theatre" })
    );
    assert.equal(result?.priority, 2);
  });

  it("Ringling at Save Mart → P1", () => {
    const result = suggestEditorialPriority(
      row({
        title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
        venue_name: "Save Mart Center"
      })
    );
    assert.equal(result?.priority, 1);
  });

  it("Monster Jam at Save Mart → P1", () => {
    const result = suggestEditorialPriority(
      row({ title: "Monster Jam", venue_name: "Save Mart Center", suggested_priority: 5 })
    );
    assert.equal(result?.priority, 1);
  });

  it("Away minor league at Valley Strong → P5", () => {
    const result = suggestEditorialPriority(
      row({
        title: "Visalia Rawhide vs. Stockton Ports",
        venue_name: "Valley Strong Ballpark",
        source: "ticketmaster"
      })
    );
    assert.equal(result?.priority, 5);
  });

  it("Grizzlies home game is not away-minor-league", () => {
    const result = suggestEditorialPriority(
      row({
        title: "Fresno Grizzlies vs. Stockton Ports",
        venue_name: "Chukchansi Park",
        source: "ticketmaster"
      })
    );
    assert.notEqual(result?.ruleId, "away-minor-league");
  });

  it("LDS ward activity → P5", () => {
    const result = suggestEditorialPriority(
      row({ title: "YSA FHE", venue_name: "The Church of Jesus Christ of Latter-day Saints" })
    );
    assert.equal(result?.priority, 5);
  });

  it("Fresno Flea Market → P5", () => {
    const result = suggestEditorialPriority(
      row({
        title: "Fresno Flea Market",
        venue_name: "Big Fresno Fair",
        source: "scrape:www.fresnofair.com",
        suggested_priority: 1
      })
    );
    assert.equal(result?.priority, 5);
  });

  it("defaults missing suggested_priority to 5", () => {
    assert.equal(currentSuggestedPriority(row({ suggested_priority: null })), 5);
  });
});
