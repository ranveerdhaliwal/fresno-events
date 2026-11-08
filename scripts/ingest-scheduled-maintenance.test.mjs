import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const maintenance=fileURLToPath(new URL('./ingest-scheduled-maintenance.sh',import.meta.url));
function run(fn,env={}) {
 const script=`source "$1"
scheduled_record_step() { echo "record:$*"; }
pnpm() { echo "pnpm:$*"; }
scheduled_ensure_api_worker() { :; }
scheduled_orphan_preview_json() { echo '{}'; }
ingest_print_orphan_cleanup_summary() { :; }
ingest_json_summary_field() { if [[ "$2" == wouldDelete ]]; then echo 2; else echo 0; fi; }
${fn}
`;
 const r=spawnSync('bash',['-c',script,'test',maintenance],{encoding:'utf8',env:{...process.env,INGEST_SCHEDULED_APPLY_RELINK:'',INGEST_SCHEDULED_APPLY_ORPHANS:'',...env}});
 assert.equal(r.status,0,r.stderr);return r.stdout;
}
test('normal workflow previews relink and never applies it implicitly',()=>{const s=run('scheduled_run_relink_maintenance');assert.ok(s.includes('pnpm:ingest:relink --dry-run'));assert.ok(!s.includes('pnpm:ingest:relink\n'));});
test('normal workflow previews orphans without deleting existing publications',()=>{const s=run('scheduled_run_orphan_maintenance');assert.ok(s.includes('orphan-apply skipped'));assert.ok(!s.includes('pnpm:review:orphan-cleanup'));});
test('explicit relink opt-in still runs the dry-run first',()=>{const s=run('scheduled_run_relink_maintenance',{INGEST_SCHEDULED_APPLY_RELINK:'1'});assert.ok(s.indexOf('pnpm:ingest:relink --dry-run')<s.indexOf('pnpm:ingest:relink\n'));});
