// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/routes/review/candidate.service", () => ({ listAllCandidatesByStatus: vi.fn(async () => []) }));
vi.mock("@/lib/structured-log", () => ({ logStructured: vi.fn() }));
import { runPreApproveAudit } from "./queue-audit.service";
import { listAllCandidatesByStatus } from "./candidate.service";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("audits publications past Supabase's 1,000-row cap with stable pagination", async () => {
  const rows = Array.from({length: 1001}, (_,i) => ({id:`event-${i}`,slug:`show-${i}`,title:`Show ${i}`,start_ts:"2026-11-12T03:00:00Z",occurrence_id:`occ-${i}`,source_event_id:null,venues:{name:"Theatre"}}));
  const offsets: number[] = [];
  vi.mocked(listAllCandidatesByStatus).mockResolvedValueOnce([{id:"pending",title:"Show 1000",startTs:"2026-11-12T03:00:00Z",venueName:"Theatre",occurrenceId:"new-pending-occurrence",source:"test"}] as never);
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("event_candidates")) return Response.json([]);
    expect(url.searchParams.get("order")).toBe("id.asc");
    const offset=Number(url.searchParams.get("offset")); offsets.push(offset);
    return Response.json(rows.slice(offset,offset+Number(url.searchParams.get("limit"))));
  }));
  const audit = await runPreApproveAudit({SUPABASE_URL:"https://database.test",SUPABASE_SERVICE_ROLE_KEY:"test-key"} as never);
  expect(audit.summary.scheduledEvents).toBe(1001);
  expect(offsets).toEqual([0,500,1000]);
  expect(audit.issues.some(i => i.candidateId === "pending")).toBe(true);
});
