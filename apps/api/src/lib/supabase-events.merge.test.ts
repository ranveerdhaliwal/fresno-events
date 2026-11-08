// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {getEventFromSupabase} from './supabase-events';
const env={SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'test'};
const target='ba3616be-2f38-48f3-804c-4adeeefad2b7';
afterEach(()=>vi.unstubAllGlobals());
it('resolves a superseded slug to its active canonical event without deleting the old record',async()=>{
 const fetcher=vi.fn(async(input:string)=>{
  const u=new URL(input);const p=u.searchParams;
  if(p.get('slug')==='eq.old-show'&&p.get('status')==='eq.superseded')return Response.json([{id:'old',status:'superseded',source_refs:{canonical_event_id:target}}]);
  if(p.get('id')===`eq.${target}`)return Response.json([{id:target,slug:'canonical-show',title:'Show',source:'ticketmaster',start_ts:'2026-11-26T03:00:00Z',status:'scheduled',source_refs:{},venue:{id:'venue',name:'Strummers',city:'Fresno',lat:36.75,lng:-119.8}}]);
  return Response.json([]);
 });
 vi.stubGlobal('fetch',fetcher);
 const r=await getEventFromSupabase(env as never,'old-show');
 expect(r?.event.id).toBe(target);expect(r?.event.slug).toBe('canonical-show');
 expect(fetcher.mock.calls.every(([u])=>new URL(u).hostname==='database.test')).toBe(true);
});
it.each(['https://evil.test/event','not-a-uuid',null])('ignores an invalid merge pointer %s',async pointer=>{
 const f=vi.fn(async(input:string)=>Response.json(new URL(input).searchParams.get('status')==='eq.superseded'?[{source_refs:{canonical_event_id:pointer}}]:[]));vi.stubGlobal('fetch',f);
 expect(await getEventFromSupabase(env as never,'old')).toBeNull();expect(f).toHaveBeenCalledTimes(2);
});
it('does not follow a cycle or reveal an unpublished canonical event',async()=>{
 const f=vi.fn(async(input:string)=>Response.json(new URL(input).searchParams.get('status')==='eq.superseded'?[{source_refs:{canonical_event_id:target}}]:[]));vi.stubGlobal('fetch',f);
 expect(await getEventFromSupabase(env as never,'old')).toBeNull();expect(f).toHaveBeenCalledTimes(3);
});
