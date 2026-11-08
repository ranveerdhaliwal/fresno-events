import { afterEach, expect, it, vi } from "vitest";
import { fetchPublishedEvents } from "./occurrence-relink";
afterEach(() => vi.unstubAllGlobals());
it("retains published occurrence identities beyond the REST response cap", async () => {
  const rows = Array.from({length:1001},(_,i)=>({id:`event-${i}`,occurrence_id:`occ-${i}`,occurrence_key:`key-${i}`,status:"scheduled"}));
  const offsets: number[]=[];
  vi.stubGlobal("fetch",vi.fn(async (input:string)=>{
    const url=new URL(input);expect(url.searchParams.get('order')).toBe('id.asc');
    const offset=Number(url.searchParams.get('offset'));offsets.push(offset);
    return Response.json(rows.slice(offset,offset+Number(url.searchParams.get('limit'))));
  }));
  const result=await fetchPublishedEvents({url:'https://database.test',serviceRoleKey:'test'});
  expect(result).toHaveLength(1001);expect(result[1000]?.occurrence_id).toBe('occ-1000');expect(offsets).toEqual([0,1000]);
});
