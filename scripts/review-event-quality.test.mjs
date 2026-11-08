import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectEventQuality } from './review-event-quality.utils.mjs';
const event = (patch = {}) => ({ title: 'Evening concert', startTs: '2026-11-05T03:00:00Z', venueName: 'Theatre', venueAddress: '100 Fulton St', venueLat: 36.7378, venueLng: -119.7871, ...patch });
const candidate = (id, e, patch = {}) => ({ id, status: 'pending_review', normalized_event: e, ...patch });
test('flags independent duplicate rows without conflating different performances', () => {
  const r = inspectEventQuality([candidate('a', event()), candidate('b', event()), candidate('matinee', event({startTs:'2026-11-04T21:00:00Z'})), candidate('different-stage', event({venueName:'Other stage'}))], []);
  assert.equal(r.duplicateGroups.length, 1);
  assert.deepEqual(r.duplicateGroups[0].map(x => x.id), ['a','b']);
});
test('does not flag an already-linked candidate as a second publication', () => {
  const e = event();
  const published = {id:'p',status:'scheduled',title:e.title,start_ts:e.startTs,venues:{name:e.venueName,address:e.venueAddress,lat:e.venueLat,lng:e.venueLng}};
  assert.equal(inspectEventQuality([candidate('a',e,{matched_event_id:'p',status:'needs_changes'})],[published]).duplicateGroups.length,0);
  assert.equal(inspectEventQuality([candidate('a',e)],[published]).duplicateGroups.length,1);
});
test('detects invalid pins, out-of-area venues, inverted durations and recurring series gaps', () => {
  const rows = [candidate('bad',event({venueLat:0,venueLng:0,endTs:'2026-11-05T02:00:00Z'})),candidate('away',event({venueLat:37.8,venueLng:-122.2,venueName:'Moraga'})),candidate('next',event({startTs:'2026-11-12T03:00:00Z'})),candidate('third',event({startTs:'2026-11-19T03:00:00Z'}))];
  const r=inspectEventQuality(rows,[]);
  for(const code of ['missing_or_invalid_coordinates','outside_coverage','end_not_after_start']) assert.ok(r.issues.some(i=>i.code===code));
  assert.equal(r.seriesGaps.length,1);
});
test('surfaces a copied fallback pin across unrelated street addresses', () => {
  const r=inspectEventQuality([1,2,3,4].map(i=>candidate(String(i),event({venueName:`Venue ${i}`,venueAddress:`${i} Main St`})) ),[]);
  assert.equal(r.suspiciousSharedPins.length,1);
});

test('flags possible doors/show pairs across sources while preserving separate performance identities', () => {
  const r=inspectEventQuality([
    candidate('doors',event({title:'Bodysnatcher: Tour with guests',source:'venue'})),
    candidate('show',event({title:'Bodysnatcher: Hell Is Here',startTs:'2026-11-05T04:00:00Z',source:'ticketmaster'})),
    candidate('other-show',event({title:'Different Band',startTs:'2026-11-05T04:00:00Z',source:'ticketmaster'}))
  ],[]);
  assert.equal(r.duplicateGroups.length,0);
  assert.equal(r.possibleDoorShowPairs.length,1);
  assert.deepEqual(r.possibleDoorShowPairs[0].ids,['doors','show']);
});

test('keeps unannounced start times visible to manual review', () => {
 const r=inspectEventQuality([candidate('tba',event({timeUnknown:true}))],[]);
 assert.ok(r.issues.some(i=>i.code==='unannounced_start_time'&&i.id==='tba'));
});

test('checks published durations as well as queued candidate durations', () => {
 const r=inspectEventQuality([], [{ id:'published-inverted',status:'scheduled',title:'Concert',start_ts:'2026-11-10T03:00:00Z',end_ts:'2026-11-10T02:00:00Z',venues:{name:'Theatre',address:'100 Fulton St',lat:36.7378,lng:-119.7871}}]);
 assert.ok(r.issues.some(i=>i.kind==='published'&&i.id==='published-inverted'&&i.code==='end_not_after_start'));
});
