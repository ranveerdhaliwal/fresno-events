import { describe, expect, it, vi, beforeEach } from "vitest";

import { runPublishedOrphanCleanupOps } from "@/routes/review/published-orphan.service";

vi.mock("@/routes/review/supabase.utils", () => ({
  supabaseReviewRequest: vi.fn()
}));

import { supabaseReviewRequest } from "@/routes/review/supabase.utils";

const mockedRequest = vi.mocked(supabaseReviewRequest);

describe("runPublishedOrphanCleanupOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dry-run reports orphan published duplicates without deleting", async () => {
    mockedRequest.mockImplementation(async (env, path, init) => {
      if (path.startsWith("/rest/v1/events?") && init?.method === "DELETE") {
        throw new Error("DELETE should not run in dry-run");
      }
      if (path.includes("event_candidates")) {
        return [{ matched_event_id: "evt-keep" }];
      }
      return [
        {
          id: "evt-keep",
          slug: "ringling-keep",
          title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
          start_ts: "2026-07-05T20:00:00.000-07:00",
          source: "scrape:www.savemartcenter.com",
          occurrence_id: "occ-keep",
          venues: { name: "Save Mart Center" }
        },
        {
          id: "evt-drop",
          slug: "ringling-drop",
          title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
          start_ts: "2026-07-05T20:00:00.000-07:00",
          source: "ticketmaster",
          occurrence_id: "occ-drop",
          venues: { name: "Save Mart Center" }
        }
      ];
    });

    const result = await runPublishedOrphanCleanupOps({} as never, true);

    expect(result.dryRun).toBe(true);
    expect(result.summary.wouldDelete).toBe(1);
    expect(result.summary.deleted).toBe(0);
    expect(result.summary.deletions[0]?.eventId).toBe("evt-drop");
    expect(result.summary.deletions[0]?.keepEventId).toBe("evt-keep");
  });

  it("apply deletes planned orphan rows", async () => {
    mockedRequest.mockImplementation(async (env, path, init) => {
      if (path.includes("event_candidates")) {
        return [{ matched_event_id: "evt-keep" }];
      }
      if (init?.method === "DELETE") {
        return null;
      }
      return [
        {
          id: "evt-keep",
          slug: "ringling-keep",
          title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
          start_ts: "2026-07-05T20:00:00.000-07:00",
          source: "scrape:www.savemartcenter.com",
          occurrence_id: "occ-keep",
          venues: { name: "Save Mart Center" }
        },
        {
          id: "evt-drop",
          slug: "ringling-drop",
          title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
          start_ts: "2026-07-05T20:00:00.000-07:00",
          source: "ticketmaster",
          occurrence_id: "occ-drop",
          venues: { name: "Save Mart Center" }
        }
      ];
    });

    const result = await runPublishedOrphanCleanupOps({} as never, false);

    expect(result.summary.deleted).toBe(1);
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.anything(),
      "/rest/v1/events?id=eq.evt-drop",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

it("finds an orphan beyond row 1,000 while dry-run sends no deletes", async () => {
  const common = {title:"Touring show",start_ts:"2026-11-05T03:00:00Z",source:"ticketmaster",venues:{name:"Theatre"}};
  const rows=Array.from({length:1001},(_,i)=>({ ...common,id:`event-${i}`,slug:`event-${i}`,title:`Show ${i}`,occurrence_id:`occ-${i}`}));
  rows[1000]={...rows[1000]!,title:rows[0]!.title};
  const offsets: number[]=[];
  mockedRequest.mockImplementation(async (_env,path,init)=>{
    expect(init?.method).not.toBe("DELETE");
    const url=new URL(path,"https://database.test");
    if(path.includes('event_candidates'))return [{matched_event_id:'event-0'}];
    const offset=Number(url.searchParams.get('offset'));offsets.push(offset);
    return rows.slice(offset,offset+Number(url.searchParams.get('limit')));
  });
  const result=await runPublishedOrphanCleanupOps({} as never,true);
  expect(result.summary.scheduledScanned).toBe(1001);expect(result.summary.wouldDelete).toBe(1);
  expect(result.summary.deletions[0]?.eventId).toBe('event-1000');expect(offsets).toEqual([0,500,1000]);
});
