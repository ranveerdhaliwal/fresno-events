import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
// Replace only downstream scripts in a temporary fixture; exercise the actual dispatcher.
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'promote-all-test-'));
fs.mkdirSync(path.join(fixture,'scripts'));
fs.copyFileSync(new URL('./ingest-promote-all.sh',import.meta.url),path.join(fixture,'scripts/ingest-promote-all.sh'));
for(const [name,label] of [['ingest-scheduled-local.sh','full'],['ingest-promote-venues.sh','venues']]) fs.writeFileSync(path.join(fixture,'scripts',name),`printf '%s\\n' '${label}' "$@"\n`);
const run=args=>spawnSync('bash',[path.join(fixture,'scripts/ingest-promote-all.sh'),...args],{encoding:'utf8'});
test('default dispatches full pipeline once',()=>assert.equal(run([]).stdout,'full\n'));
test('internal venue pass preserves arguments and does not recurse',()=>assert.equal(run(['--venues-only','--no-enrich','--dry-run']).stdout,'venues\n--no-enrich\n--dry-run\n'));
test('legacy no-enrich stays collection-only',()=>assert.equal(run(['--no-enrich']).stdout,'venues\n--no-enrich\n'));
test('rejects unhandled full-run flags before any collection',()=>{const r=run(['--dry-run']);assert.equal(r.status,2);assert.equal(r.stdout,'');});
test.after(()=>fs.rmSync(fixture,{recursive:true,force:true}));
