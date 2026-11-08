import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function runBatch(firstReply) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'enrichment-stop-'));
  const scripts = path.join(fixture, 'scripts');
  fs.mkdirSync(scripts);
  fs.copyFileSync(new URL('./ingest-enrich.sh', import.meta.url), path.join(scripts, 'ingest-enrich.sh'));
  fs.writeFileSync(path.join(scripts, 'ingest-lib.sh'), `
ingest_load_admin_token(){ :; }
ingest_curl_json(){
  echo call >> "$ENRICH_TEST_CALLS"
  if [[ "$(wc -l < "$ENRICH_TEST_CALLS")" -eq 1 ]]; then
    echo "$ENRICH_TEST_REPLY"
  else
    echo '{"data":{"summary":{"processed":0,"updated":0,"errors":0,"skipped_no_backend":false}}}'
  fi
}
ingest_json_summary_field(){
  python3 -c 'import json,sys; print(json.loads(sys.argv[1])["data"]["summary"][sys.argv[2]])' "$1" "$2"
}
ingest_json_summary_bool(){ echo false; }
`);
  const calls = path.join(fixture, 'calls');
  const result = spawnSync('bash', [path.join(scripts, 'ingest-enrich.sh'), '--all'], {
    encoding: 'utf8', timeout: 10000,
    env: {...process.env, ENRICH_TEST_CALLS: calls, ENRICH_TEST_REPLY: JSON.stringify({data: {summary: firstReply}})}
  });
  const count = fs.readFileSync(calls, 'utf8').trim().split('\n').length;
  fs.rmSync(fixture, {recursive: true, force: true});
  return {...result, count};
}

test('stops after a backend failure instead of retrying the same pending row', () => {
  const result = runBatch({processed: 1, updated: 0, errors: 1});
  assert.equal(result.status, 1);
  assert.equal(result.count, 1);
});

test('also stops a legacy zero-progress response whose error count is zero', () => {
  const result = runBatch({processed: 1, updated: 0, errors: 0});
  assert.equal(result.status, 1);
  assert.equal(result.count, 1);
});

test('continues successful batches until the queue is empty', () => {
  const result = runBatch({processed: 3, updated: 3, errors: 0});
  assert.equal(result.status, 0);
  assert.equal(result.count, 2);
});
