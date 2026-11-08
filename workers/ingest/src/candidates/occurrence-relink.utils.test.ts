import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  computeRelinkPatches,
  summarizeRelinkLinkGroups,
  type RelinkCandidateRow
} from "@/candidates/occurrence-relink.utils";

function row(input: {
  id: string;
  source: string;
  title: string;
  source_event_id?: string;
  status?: string;
  matched_event_id?: string | null;
  canonical_candidate_id?: string | null;
  occurrence_id?: string | null;
  occurrence_key?: string | null;
  url_key?: string | null;
  suggested_priority?: number | null;
  created_at?: string;
  normalized_event?: Partial<NormalizedEvent>;
}): RelinkCandidateRow {
  const normalizedEvent: NormalizedEvent = {
    source: input.source as NormalizedEvent["source"],
    sourceEventId: input.source_event_id ?? input.id,
    title: input.title,
    venueName: input.normalized_event?.venueName ?? "William Saroyan Theatre",
    startTs: input.normalized_event?.startTs ?? "2026-06-17T02:00:00.000Z",
    category: input.normalized_event?.category ?? "theater",
    ...input.normalized_event
  };

  return {
    id: input.id,
    source: input.source,
    source_event_id: input.source_event_id ?? input.id,
    status: input.status ?? "pending_review",
    matched_event_id: input.matched_event_id ?? null,
    canonical_candidate_id: input.canonical_candidate_id ?? null,
    occurrence_id: input.occurrence_id ?? crypto.randomUUID(),
    occurrence_key: input.occurrence_key ?? null,
    url_key: input.url_key ?? null,
    suggested_priority: input.suggested_priority ?? null,
    created_at: input.created_at ?? "2026-01-01T00:00:00.000Z",
    normalized_event: normalizedEvent
  };
}

describe("computeRelinkPatches", () => {
  it("keeps all separately timed Fair sets under one parent, even within a 30-minute bucket", async () => {
    const common = {
      venueName: "Big Fresno Fair",
      externalUrl: "https://www.fresnofair.com/events/2026/kids-town",
      seriesId: "series:bigfresnofair:2026",
      seriesName: "Big Fresno Fair"
    };
    const rows = ["21:05", "21:15", "21:25", "23:15"].map((clock, i) =>
      row({
        id: `fair-${i}`,
        source: "scrape:www.fresnofair.com",
        title: "Kids Town Dance Party",
        source_event_id: `venue:big-fresno-fair:${4001 + i}:2026-10-15`,
        status: i ? "duplicate" : "pending_review",
        canonical_candidate_id: i ? "fair-0" : null,
        normalized_event: { ...common, startTs: `2026-10-15T${clock}:00.000Z` }
      })
    );
    rows.push(
      row({
        id: "unknown",
        source: "api:visitfresnocounty",
        title: "Kids Town Dance Party",
        normalized_event: {
          ...common,
          startTs: "2026-10-15T12:00:00.000Z",
          timeUnknown: true
        }
      })
    );
    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    expect(new Set(patches.map((p) => p.occurrence_id)).size).toBe(5);
    expect(
      patches.every((p) => p.canonical_candidate_id === null && p.status === "pending_review")
    ).toBe(true);
    expect(rows.every((r) => r.normalized_event.seriesId === "series:bigfresnofair:2026")).toBe(
      true
    );
  });
  it("still links the same timed Fair performance from two sources", async () => {
    const normalized_event = {
      venueName: "Big Fresno Fair",
      startTs: "2026-10-15T21:15:00.000Z",
      ticketUrl: "https://www.ticketmaster.com/event/FAIR123"
    };
    const { patches } = await computeRelinkPatches(
      [
        row({
          id: "fair",
          source: "scrape:www.fresnofair.com",
          source_event_id: "venue:big-fresno-fair:4001:2026-10-15",
          title: "Artist",
          normalized_event
        }),
        row({
          id: "tm",
          source: "ticketmaster",
          title: "Artist",
          normalized_event: {
            ...normalized_event,
            venueName: "Paul Paul Theatre"
          }
        })
      ],
      [],
      { crossSourceDedupe: true }
    );
    expect(new Set(patches.map((p) => p.occurrence_id)).size).toBe(1);
    expect(patches.find((p) => p.id === "fair")?.canonical_candidate_id).toBe("tm");
  });
  it("does not merge distinct same-time Fair CMS listings through a third shared ticket source", async () => {
    const normalized_event = {
      venueName: "Big Fresno Fair",
      startTs: "2026-10-15T21:15:00.000Z",
      ticketUrl: "https://www.ticketmaster.com/event/FAIR123"
    };
    const { patches } = await computeRelinkPatches(
      [
        row({
          id: "fair-a",
          source: "scrape:www.fresnofair.com",
          source_event_id: "venue:big-fresno-fair:4001:2026-10-15",
          title: "Artist",
          normalized_event
        }),
        row({
          id: "fair-b",
          source: "scrape:www.fresnofair.com",
          source_event_id: "venue:big-fresno-fair:4002:2026-10-15",
          title: "Artist",
          normalized_event
        }),
        row({
          id: "tm",
          source: "ticketmaster",
          title: "Artist",
          normalized_event
        })
      ],
      [],
      { crossSourceDedupe: true }
    );
    expect(patches.find((p) => p.id === "fair-a")?.occurrence_id).not.toBe(
      patches.find((p) => p.id === "fair-b")?.occurrence_id
    );
  });
  it("links Miss California rows across title variants and prefers ticketmaster", async () => {
    const rows = [
      row({
        id: "visit",
        source: "api:visitfresnocounty",
        title: "Miss California Competition Week",
        created_at: "2026-01-01T00:00:00.000Z"
      }),
      row({
        id: "scrape",
        source: "scrape:events.fresnoconventioncenter.com",
        title: "Miss California 2026",
        normalized_event: { venueName: "Saroyan Theatre" },
        created_at: "2026-01-02T00:00:00.000Z"
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Miss California 2026",
        created_at: "2026-01-03T00:00:00.000Z"
      })
    ];

    const { patches, summary } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const byId = new Map(patches.map((patch) => [patch.id, patch]));

    expect(summary.multi_source_groups).toBe(1);
    expect(byId.get("tm")?.canonical_candidate_id).toBeNull();
    expect(byId.get("visit")?.status).toBe("duplicate");
    expect(byId.get("scrape")?.status).toBe("duplicate");
    expect(byId.get("visit")?.canonical_candidate_id).toBe("tm");
    expect(byId.get("scrape")?.canonical_candidate_id).toBe("tm");
    expect(byId.get("visit")?.occurrence_id).toBe(byId.get("tm")?.occurrence_id);
  });

  it("keeps teen and main pageant nights separate", async () => {
    const rows = [
      row({
        id: "main",
        source: "ticketmaster",
        title: "Miss California 2026"
      }),
      row({
        id: "teen",
        source: "ticketmaster",
        title: "Miss California's Teen 2026"
      })
    ];

    const { patches, summary } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const main = patches.find((patch) => patch.id === "main");
    const teen = patches.find((patch) => patch.id === "teen");

    expect(summary.multi_source_groups).toBe(0);
    expect(main?.occurrence_id).not.toBe(teen?.occurrence_id);
    expect(main?.occurrence_key).not.toBe(teen?.occurrence_key);
  });

  it("skips rejected rows and leaves them out of cross-source groups", async () => {
    const rows = [
      row({
        id: "rejected",
        source: "ticketmaster",
        title: "Miss California 2026",
        status: "rejected"
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Miss California 2026",
        normalized_event: { startTs: "2026-06-18T02:00:00.000Z" }
      })
    ];

    const { patches, summary } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });

    expect(summary.skipped_rejected).toBe(1);
    expect(summary.relinkable).toBe(1);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.id).toBe("tm");
  });

  it("promotes a duplicate row back to pending_review when it becomes primary", async () => {
    const rows = [
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Miss California 2026",
        status: "duplicate",
        canonical_candidate_id: "old-primary"
      }),
      row({
        id: "scrape",
        source: "scrape:events.fresnoconventioncenter.com",
        title: "Miss California Competition Week",
        normalized_event: { venueName: "Saroyan Theatre" }
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const tm = patches.find((patch) => patch.id === "tm");

    expect(tm?.status).toBe("pending_review");
    expect(tm?.canonical_candidate_id).toBeNull();
  });

  it("links save mart and ticketmaster rows that share a ticketmaster event id across date drift", async () => {
    const affiliate =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fnate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026%2Fevent%2F1C00631A8DE414D4";
    const direct =
      "https://www.ticketmaster.com/nate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026/event/1C00631A8DE414D4";
    const rows = [
      row({
        id: "savemart",
        source: "scrape:www.savemartcenter.com",
        title: "Nate Bargatze: Big Dumb Eyes World Tour",
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-21T02:00:00.000Z",
          ticketUrl: affiliate
        }
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Nate Bargatze: Big Dumb Eyes World Tour",
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-20T02:00:00.000Z",
          ticketUrl: direct
        }
      })
    ];

    const { patches, summary } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const byId = new Map(patches.map((patch) => [patch.id, patch]));

    expect(summary.multi_source_groups).toBe(1);
    expect(byId.get("tm")?.canonical_candidate_id).toBeNull();
    expect(byId.get("savemart")?.status).toBe("duplicate");
    expect(byId.get("savemart")?.occurrence_id).toBe(byId.get("tm")?.occurrence_id);
  });

  it("inherits best suggested_priority onto ticketmaster primary from linked duplicates", async () => {
    const affiliate =
      "https://ticketmaster.evyy.net/c/4241810/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fnate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026%2Fevent%2F1C00631A8DE414D4";
    const direct =
      "https://www.ticketmaster.com/nate-bargatze-big-dumb-eyes-world-fresno-california-07-19-2026/event/1C00631A8DE414D4";
    const rows = [
      row({
        id: "savemart",
        source: "scrape:www.savemartcenter.com",
        title: "Nate Bargatze: Big Dumb Eyes World Tour",
        suggested_priority: 1,
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-21T02:00:00.000Z",
          ticketUrl: affiliate
        }
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Nate Bargatze: Big Dumb Eyes World Tour",
        suggested_priority: 5,
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-20T02:00:00.000Z",
          ticketUrl: direct
        }
      })
    ];

    const { patches, summary } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const tm = patches.find((patch) => patch.id === "tm");

    expect(summary.priority_inherited).toBe(1);
    expect(tm?.suggested_priority).toBe(1);
    expect(tm?.canonical_candidate_id).toBeNull();
  });

  it("does not merge multi-night series URLs across different show times", async () => {
    const sharedUrl = "https://www.visitfresnocounty.org/event/miss-california/9109/";
    const rows = [
      row({
        id: "visit-16",
        source: "api:visitfresnocounty",
        title: "Miss California Competition Week",
        status: "approved",
        matched_event_id: "evt-16",
        normalized_event: {
          startTs: "2026-06-17T02:00:00.000Z",
          externalUrl: sharedUrl,
          ticketUrl: sharedUrl
        }
      }),
      row({
        id: "visit-17",
        source: "api:visitfresnocounty",
        title: "Miss California Competition Week",
        status: "duplicate",
        matched_event_id: "evt-17",
        normalized_event: {
          startTs: "2026-06-18T02:00:00.000Z",
          externalUrl: sharedUrl,
          ticketUrl: sharedUrl
        }
      }),
      row({
        id: "tm-16",
        source: "ticketmaster",
        title: "Miss California 2026",
        normalized_event: {
          startTs: "2026-06-17T02:00:00.000Z",
          ticketUrl: "https://www.ticketmaster.com/event/abc123"
        }
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const byId = new Map(patches.map((patch) => [patch.id, patch]));

    expect(byId.get("tm-16")?.occurrence_id).toBe(byId.get("visit-16")?.occurrence_id);
    expect(byId.get("visit-17")?.occurrence_id).not.toBe(byId.get("visit-16")?.occurrence_id);
    expect(byId.get("visit-17")?.status).toBe("approved");
    expect(byId.get("visit-17")?.canonical_candidate_id).toBeNull();
    expect(byId.get("tm-16")?.status).toBe("duplicate");
  });

  it("prefers published Visit over Ticketmaster when both have matched_event_id", async () => {
    const rows = [
      row({
        id: "visit-17",
        source: "api:visitfresnocounty",
        title: "Miss California Competition Week",
        status: "duplicate",
        matched_event_id: "evt-visit-17",
        normalized_event: { startTs: "2026-06-18T02:00:00.000Z" }
      }),
      row({
        id: "tm-17",
        source: "ticketmaster",
        title: "Miss California 2026",
        status: "approved",
        matched_event_id: "evt-tm-17",
        normalized_event: { startTs: "2026-06-18T02:00:00.000Z" }
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const byId = new Map(patches.map((patch) => [patch.id, patch]));

    expect(byId.get("visit-17")?.status).toBe("approved");
    expect(byId.get("visit-17")?.canonical_candidate_id).toBeNull();
    expect(byId.get("tm-17")?.status).toBe("duplicate");
    expect(byId.get("tm-17")?.canonical_candidate_id).toBe("visit-17");
  });

  it("assigns distinct occurrence_id per occurrence_key", async () => {
    const { occurrenceIdFromKey } = await import("@/candidates/occurrence-relink.utils");
    const rows = [
      row({
        id: "night-one",
        source: "ticketmaster",
        title: "Miss California 2026",
        normalized_event: { startTs: "2026-06-17T02:00:00.000Z" }
      }),
      row({
        id: "night-two",
        source: "ticketmaster",
        title: "Miss California 2026",
        normalized_event: { startTs: "2026-06-18T02:00:00.000Z" }
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const one = patches.find((patch) => patch.id === "night-one");
    const two = patches.find((patch) => patch.id === "night-two");

    expect(one?.occurrence_key).not.toBe(two?.occurrence_key);
    expect(one?.occurrence_id).not.toBe(two?.occurrence_id);
    if (one?.occurrence_key) {
      expect(one.occurrence_id).toBe(await occurrenceIdFromKey(one.occurrence_key));
    }
  });

  it("summarizeRelinkLinkGroups returns human-readable link examples", async () => {
    const rows = [
      row({
        id: "visit",
        source: "api:visitfresnocounty",
        title: "Miss California Competition Week",
        created_at: "2026-01-01T00:00:00.000Z"
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Miss California 2026",
        created_at: "2026-01-03T00:00:00.000Z"
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const changedIds = new Set(patches.map((patch) => patch.id));
    const summary = summarizeRelinkLinkGroups(rows, patches, changedIds, {
      crossSourceDedupe: true
    });

    expect(summary.link_groups).toBe(1);
    expect(summary.link_groups_changed).toBe(1);
    expect(summary.link_examples[0]?.title).toContain("Miss California");
    expect(summary.link_examples[0]?.primary_source).toBe("ticketmaster");
    expect(summary.link_examples[0]?.linked_sources).toContain("visitfresnocounty");
  });

  it("demotes linked needs_changes secondaries to duplicate on relink", async () => {
    const rows = [
      row({
        id: "primary",
        source: "scrape:www.savemartcenter.com",
        title: "Nate Bargatze",
        status: "approved",
        matched_event_id: "evt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-20T02:00:00.000Z"
        }
      }),
      row({
        id: "tm",
        source: "ticketmaster",
        title: "Nate Bargatze",
        status: "needs_changes",
        matched_event_id: "evt-1",
        created_at: "2026-01-02T00:00:00.000Z",
        normalized_event: {
          venueName: "Save Mart Center",
          startTs: "2026-07-20T02:00:00.000Z"
        }
      })
    ];

    const { patches } = await computeRelinkPatches(rows, [], {
      crossSourceDedupe: true
    });
    const tmPatch = patches.find((patch) => patch.id === "tm");

    expect(tmPatch?.canonical_candidate_id).toBe("primary");
    expect(tmPatch?.status).toBe("duplicate");
  });
});
