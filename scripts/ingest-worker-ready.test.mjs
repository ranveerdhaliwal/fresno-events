import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const lib=fileURLToPath(new URL('./ingest-lib.sh',import.meta.url));
const run=body=>spawnSync('bash',['-c',`source "$1"\nchecks=0\nsleep(){ :; }\n${body}\ningest_wait_for_worker_ready 8788\nresult=$?\necho "result=$result checks=$checks"`,'test',lib],{encoding:'utf8'});
test('requires three consecutive successes and resets after a watch reload',()=>{
 const r=run('curl(){ checks=$((checks+1)); [[ "$checks" -ne 2 ]]; }');
 assert.ok(r.stdout.includes('result=0 checks=5'));
});
test('returns failure after bounded health checks without sending maintenance',()=>{
 const r=run('curl(){ checks=$((checks+1)); return 1; }');
 assert.ok(r.stdout.includes('result=1 checks=45'));assert.ok(r.stderr.includes('maintenance was not sent'));
});
