const normalize = value => String(value ?? '').toLowerCase().replace(/\(\d{4}-\d{2}-\d{2}\)/g, '').replace(/[^a-z0-9]/g, '');
export function distanceMiles(a, b) {
  const rad = value => value * Math.PI / 180;
  const dlat = rad(b[0] - a[0]); const dlng = rad(b[1] - a[1]);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dlng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function inspectEventQuality(candidates, events) {
  const pending = candidates.filter(r => ['pending_review', 'needs_changes', 'awaiting_enrichment'].includes(r.status));
  const published = events.filter(r => r.status === 'scheduled');
  const records = [
    ...pending.map(r => ({ kind: 'candidate', id: r.id, source: r.source ?? r.normalized_event?.source, event: r.normalized_event, occurrenceId: r.occurrence_id, matchedEventId: r.matched_event_id })),
    ...published.map(r => { const v = Array.isArray(r.venues) ? r.venues[0] : r.venues; return { kind: 'published', id: r.id, source: r.source, occurrenceId: r.occurrence_id, event: { title: r.title, startTs: r.start_ts, endTs: r.end_ts, seriesId: r.series_id, venueName: v?.name, venueAddress: v?.address, venueCity: v?.city, venueLat: v?.lat, venueLng: v?.lng } }; })
  ];
  const issues = []; const groups = new Map(); const series = new Map(); const pins = new Map();
  for (const r of records) {
    const e = r.event ?? {}; const pin = [e.venueLat, e.venueLng];
    const valid = pin.every(Number.isFinite) && Math.abs(pin[0]) <= 90 && Math.abs(pin[1]) <= 180 && pin.some(n => n !== 0);
    if (!valid) issues.push({ code: 'missing_or_invalid_coordinates', kind: r.kind, id: r.id, title: e.title });
    else {
      const miles = distanceMiles([36.7378, -119.7871], pin);
      if (miles > 50) issues.push({ code: 'outside_coverage', kind: r.kind, id: r.id, title: e.title, miles: Math.round(miles) });
      const key = pin.map(n => n.toFixed(5)).join(',');
      if (!pins.has(key)) pins.set(key, []); pins.get(key).push(r);
    }
    if (!e.venueAddress || !e.venueName || /^\d{3}[-.]\d{3}[-.]\d{4}$/.test(e.venueName) || /^(fresno|clovis)$/i.test(e.venueName)) issues.push({ code: 'unverified_physical_venue', kind: r.kind, id: r.id, title: e.title });
    if (e.timeUnknown === true) issues.push({ code: "unannounced_start_time", kind: r.kind, id: r.id, title: e.title });
    const start = new Date(e.startTs);
    if (!Number.isFinite(start.getTime())) { issues.push({ code: 'invalid_start', kind: r.kind, id: r.id }); continue; }
    if (e.endTs && new Date(e.endTs) <= start) issues.push({ code: 'end_not_after_start', kind: r.kind, id: r.id, title: e.title });
    const key = [normalize(e.title), normalize(e.venueName), start.toISOString()].join('|');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
    const seriesKey = [normalize(e.title), normalize(e.venueName)].join('|');
    if (!series.has(seriesKey)) series.set(seriesKey, []); series.get(seriesKey).push(r);
  }
  const duplicateGroups = [...groups.values()].filter(g => g.length > 1 && !(g.filter(r => r.kind === 'published').length === 1 && g.filter(r => r.kind === 'candidate').every(r => r.matchedEventId === g.find(x => x.kind === 'published').id))).map(g => g.map(({ event, ...r }) => ({ ...r, title: event.title, startTs: event.startTs })));
  const seriesGaps = [...series.values()].filter(g => new Set(g.map(r => r.event.startTs)).size >= 3 && g.some(r => !r.event.seriesId)).map(g => ({ title: g[0].event.title, idsWithoutSeries: g.filter(r => !r.event.seriesId).map(r => r.id), existingSeries: [...new Set(g.map(r => r.event.seriesId).filter(Boolean))] }));
  const suspiciousSharedPins = [...pins.entries()].filter(([,g]) => new Set(g.map(r => normalize(r.event.venueAddress)).filter(Boolean)).size >= 4).map(([coordinates,g]) => ({ coordinates, venues: [...new Set(g.map(r => r.event.venueName))], ids: g.map(r => r.id) }));
  // Different source start times can represent doors versus show time. Keep
  // these as review leads; never collapse distinct timed performances here.
  const headline = e => normalize(e.title?.split(/\s*(?::|[–—]|\s+with\s+|\s+vs\.?\s+)\s*/i)[0]);
  const possibleDoorShowPairs = [];
  const byHeadlineVenue = new Map();
  for (const r of records) {
    const head = headline(r.event);
    if (head.length < 6 || !r.source) continue;
    const key = `${head}|${normalize(r.event.venueName)}`;
    const peers = byHeadlineVenue.get(key) ?? [];
    for (const peer of peers) {
      const delta = Math.abs(new Date(r.event.startTs) - new Date(peer.event.startTs));
      if (peer.source === r.source || delta < 10 * 60_000 || delta > 90 * 60_000) continue;
      if (r.matchedEventId === peer.id || peer.matchedEventId === r.id) continue;
      possibleDoorShowPairs.push({ ids: [peer.id, r.id], titles: [peer.event.title, r.event.title], starts: [peer.event.startTs, r.event.startTs], reason: 'Same headline/venue across sources within 90 minutes. Confirm doors/show or distinct performances; do not merge automatically.' });
    }
    peers.push(r); byHeadlineVenue.set(key, peers);
  }
  return { summary: { candidatesScanned: pending.length, publishedScanned: published.length, issues: issues.length, duplicateGroups: duplicateGroups.length, seriesGaps: seriesGaps.length, suspiciousSharedPins: suspiciousSharedPins.length, possibleDoorShowPairs: possibleDoorShowPairs.length }, issues, duplicateGroups, seriesGaps, suspiciousSharedPins, possibleDoorShowPairs };
}
