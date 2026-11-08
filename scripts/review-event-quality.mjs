// Read-only queue/publication audit. Credentials are sent through curl stdin.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectEventQuality } from './review-event-quality.utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vars = Object.fromEntries(fs.readFileSync(path.join(root, 'apps/api/.dev.vars'), 'utf8')
  .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
  }));
const api = process.env.REVIEW_API_ORIGIN ?? `http://127.0.0.1:${process.env.FRESNO_API_PORT ?? 8790}`;
if (api !== 'https://api.whatupfresno.com' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(api)) throw Error('Unexpected review API target');
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(vars.SUPABASE_URL) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(vars.SUPABASE_URL)) throw Error('Unexpected database target');
function request(url, database = false, method = 'GET') {
  const headers = database
    ? { apikey: vars.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${vars.SUPABASE_SERVICE_ROLE_KEY}`, 'User-Agent': 'fresno-review-operations/1.0' }
    : { 'x-admin-token': vars.ADMIN_REVIEW_TOKEN, 'User-Agent': 'Mozilla/5.0' };
  const config = [`url = ${JSON.stringify(url)}`, `request = ${JSON.stringify(method)}`,
    ...Object.entries(headers).map(([k, v]) => `header = ${JSON.stringify(`${k}: ${v}`)}`)].join('\n');
  const result = spawnSync('curl', ['-q', '--config', '-', '--silent', '--show-error', '--fail-with-body', '--connect-timeout', '10', '--max-time', '120'], { input: config, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`Audit request failed (${result.status}); no mutations were sent`);
  return JSON.parse(result.stdout);
}
function all(table, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const query = new URLSearchParams({ select, order: 'id', offset: String(offset), limit: '1000' });
    const batch = request(`${vars.SUPABASE_URL}/rest/v1/${table}?${query}`, true);
    if (!Array.isArray(batch)) throw Error(`Invalid ${table} audit response`);
    rows.push(...batch); if (batch.length < 1000) return rows;
  }
}
const candidates = all('event_candidates', 'id,status,normalized_event,matched_event_id,canonical_candidate_id,occurrence_id');
const events = all('events', 'id,title,start_ts,end_ts,status,source,series_id,occurrence_id,venues(name,address,city,lat,lng)');
const report = {
  generatedAt: new Date().toISOString(), target: vars.SUPABASE_URL,
  ...inspectEventQuality(candidates, events),
  geocodePreview: request(`${api}/review/ops/venue-geocode?dry_run=true`, false, 'POST'),
  preApproveAudit: request(`${api}/review/candidates/pre-approve-audit`)
};
if (!report.geocodePreview.ok || !report.preApproveAudit.ok) throw Error('Review API returned an unsuccessful audit');
const outArg = process.argv.find(arg => arg.startsWith('--out='));
if (!outArg) throw Error('Pass --out=<review report.json>; this audit never mutates records');
fs.writeFileSync(path.resolve(outArg.slice(6)), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report.summary, preApproveAudit: report.preApproveAudit.data?.summary, report: outArg.slice(6) }, null, 2));
console.log('Review flagged IDs before approval. Geocoding and relink previews do not authorize broad status changes or deletion.');
