#!/usr/bin/env node
/**
 * Retroactively re-rank display priority using the shared deterministic rule engine
 * (packages/shared suggestEventPriority). Covers:
 *   - event_candidates.suggested_priority (pending_review primaries)
 *   - events.priority (published, excluding hand-curated manual sources)
 *
 * LOCAL ONLY by default. Refuses to run against a non-local Supabase URL unless
 * --allow-remote is passed.
 *
 * Usage:
 *   node scripts/priority-rerank.mjs            # dry-run, both tables
 *   node scripts/priority-rerank.mjs --apply    # write changes
 *   node scripts/priority-rerank.mjs --apply --events-only
 *   node scripts/priority-rerank.mjs --apply --candidates-only
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from workers/ingest/.dev.vars
 * when not already exported). Run `pnpm env:local` first if needed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { suggestEventPriority } from "../packages/shared/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PAGE_SIZE = 500;
const PATCH_BATCH_SIZE = 50;

/** @param {string} file @param {string} key */
function readDevVar(file, key) {
  try {
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((row) => row.startsWith(`${key}=`));
    if (!line) {
      return undefined;
    }
    let value = line.slice(key.length + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  } catch {
    return undefined;
  }
}

function loadSupabaseEnv() {
  const devVars = join(REPO_ROOT, "workers/ingest/.dev.vars");
  const url = process.env.SUPABASE_URL ?? readDevVar(devVars, "SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? readDevVar(devVars, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or run pnpm env:local first.");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const out = { apply: false, candidatesOnly: false, eventsOnly: false, allowRemote: false };
  for (const arg of argv) {
    if (arg === "--apply") out.apply = true;
    else if (arg === "--dry-run") out.apply = false;
    else if (arg === "--candidates-only") out.candidatesOnly = true;
    else if (arg === "--events-only") out.eventsOnly = true;
    else if (arg === "--allow-remote") out.allowRemote = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/priority-rerank.mjs [--apply] [--candidates-only|--events-only] [--allow-remote]");
      process.exit(0);
    }
  }
  return out;
}

function isLocalUrl(url) {
  return /127\.0\.0\.1|localhost/.test(url);
}

async function supabaseGet(url, key, path) {
  const response = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) {
    throw new Error(`Supabase GET ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function supabasePatch(url, key, path, body) {
  const response = await fetch(`${url}${path}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Supabase PATCH ${path} failed (${response.status}): ${await response.text()}`);
  }
}

/** @param {Array<{id:string,fromPriority:number,toPriority:number,ruleLabel:string,title:string}>} patches */
function printGrouped(patches) {
  const byRule = new Map();
  for (const patch of patches) {
    const bucket = byRule.get(patch.ruleLabel) ?? [];
    bucket.push(patch);
    byRule.set(patch.ruleLabel, bucket);
  }
  for (const [label, group] of byRule.entries()) {
    console.log(`  ${label} (${group.length})`);
    for (const p of group.slice(0, 6)) {
      console.log(`    P${p.fromPriority}→P${p.toPriority}  ${p.title}`);
    }
    if (group.length > 6) {
      console.log(`    … +${group.length - 6} more`);
    }
  }
}

/** Apply patches grouped by target priority via batched PATCH. */
async function applyByPriority(url, key, tablePath, column, patches) {
  const byPriority = new Map();
  for (const patch of patches) {
    const ids = byPriority.get(patch.toPriority) ?? [];
    ids.push(patch.id);
    byPriority.set(patch.toPriority, ids);
  }
  let applied = 0;
  for (const [priority, ids] of byPriority.entries()) {
    for (let offset = 0; offset < ids.length; offset += PATCH_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + PATCH_BATCH_SIZE);
      await supabasePatch(url, key, `${tablePath}?id=in.(${batch.join(",")})`, {
        [column]: priority,
        updated_at: new Date().toISOString()
      });
      applied += batch.length;
    }
  }
  return applied;
}

async function rerankCandidates(url, key, options) {
  const all = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: "id,title,venue_name,source,suggested_priority",
      status: "eq.pending_review",
      canonical_candidate_id: "is.null",
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    const page = await supabaseGet(url, key, `/rest/v1/event_candidates?${params}`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  const patches = [];
  for (const row of all) {
    const suggestion = suggestEventPriority({
      source: row.source,
      title: row.title,
      venueName: row.venue_name ?? ""
    });
    if (!suggestion) continue;
    const from = Number.isInteger(row.suggested_priority) ? row.suggested_priority : 5;
    if (from === suggestion.priority) continue;
    patches.push({ id: row.id, fromPriority: from, toPriority: suggestion.priority, ruleLabel: suggestion.ruleLabel, title: row.title });
  }

  console.log(`\n=== event_candidates (pending_review primaries) ===`);
  console.log(`Scanned ${all.length}, would change ${patches.length}`);
  printGrouped(patches);

  if (options.apply && patches.length > 0) {
    const applied = await applyByPriority(url, key, "/rest/v1/event_candidates", "suggested_priority", patches);
    console.log(`Applied ${applied} candidate patch(es).`);
  }
  return patches.length;
}

async function rerankEvents(url, key, options) {
  const all = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: "id,title,source,priority,venues(name)",
      // Skip hand-curated manual placements.
      source: "not.in.(manual)",
      order: "start_ts.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    const page = await supabaseGet(url, key, `/rest/v1/events?${params}`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  const patches = [];
  for (const row of all) {
    if (typeof row.source === "string" && row.source.startsWith("manual:")) continue;
    const venueName = row.venues?.name ?? "";
    const suggestion = suggestEventPriority({ source: row.source, title: row.title, venueName });
    if (!suggestion) continue;
    const from = Number.isInteger(row.priority) ? row.priority : 5;
    if (from === suggestion.priority) continue;
    patches.push({ id: row.id, fromPriority: from, toPriority: suggestion.priority, ruleLabel: suggestion.ruleLabel, title: row.title });
  }

  console.log(`\n=== events (published, excl. manual) ===`);
  console.log(`Scanned ${all.length}, would change ${patches.length}`);
  printGrouped(patches);

  if (options.apply && patches.length > 0) {
    const applied = await applyByPriority(url, key, "/rest/v1/events", "priority", patches);
    console.log(`Applied ${applied} event patch(es).`);
  }
  return patches.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { url, key } = loadSupabaseEnv();

  if (!isLocalUrl(url) && !options.allowRemote) {
    console.error(`Refusing to run against non-local target: ${url}\nPass --allow-remote to override (NOT recommended).`);
    process.exit(1);
  }

  console.log(`Priority rerank — ${options.apply ? "APPLY" : "DRY RUN"} — ${url}`);

  let total = 0;
  if (!options.eventsOnly) {
    total += await rerankCandidates(url, key, options);
  }
  if (!options.candidatesOnly) {
    total += await rerankEvents(url, key, options);
  }

  console.log("");
  if (!options.apply) {
    console.log(`Dry run complete. ${total} row(s) would change. Re-run with --apply to write.`);
  } else {
    console.log("Done.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
