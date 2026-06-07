#!/usr/bin/env node
/**
 * Apply deterministic editorial priority rules to pending review candidates.
 *
 * Usage:
 *   node scripts/admin-priority-triage.mjs [--dry-run] [--limit=N] [--source=venunite]
 *
 * Default: apply patches. Pass --dry-run to preview without writing.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from workers/ingest/.dev.vars).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  currentSuggestedPriority,
  suggestEditorialPriority
} from "./admin-priority-triage.rules.mjs";
import { parsePriorityTriageArgs } from "./admin-priority-triage.args.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PAGE_SIZE = 500;

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? readDevVar(devVars, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or run pnpm env:local first.");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

/** @param {string} url @param {string} key @param {string} query */
async function supabaseGet(url, key, query) {
  const response = await fetch(`${url}/rest/v1/event_candidates?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase GET failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

/** @param {string} url @param {string} key @param {string[]} ids @param {number} priority */
async function supabasePatchPriority(url, key, ids, priority) {
  const response = await fetch(`${url}/rest/v1/event_candidates?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ suggested_priority: priority, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error(`Supabase PATCH failed (${response.status}): ${await response.text()}`);
  }
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const parsed = parsePriorityTriageArgs(argv);
  if ("help" in parsed && parsed.help) {
    console.log(`Usage: pnpm admin:priority-triage [--dry-run] [--limit=N] [--source=SOURCE]

  Applies deterministic editorial priority rules to pending_review primaries.
  Default applies writes. Pass --dry-run to preview only.

  Examples:
    pnpm admin:priority-triage --dry-run
    pnpm admin:priority-triage
    pnpm admin:priority-triage --source=venunite --limit=200`);
    process.exit(0);
  }
  return parsed;
}

/** @param {unknown[]} rows */
function groupPatches(patches) {
  /** @type {Map<number, string[]>} */
  const byPriority = new Map();
  for (const patch of patches) {
    const bucket = byPriority.get(patch.toPriority) ?? [];
    bucket.push(patch.id);
    byPriority.set(patch.toPriority, bucket);
  }
  return byPriority;
}

async function fetchPendingPrimaries(url, key, options) {
  /** @type {import('./admin-priority-triage.rules.mjs').TriageCandidateRow[]} */
  const all = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,title,venue_name,source,suggested_priority,status",
      status: "eq.pending_review",
      canonical_candidate_id: "is.null",
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (options.source) {
      params.set("source", `eq.${options.source}`);
    }

    const page = await supabaseGet(url, key, params.toString());
    all.push(...page);
    if (options.limit !== undefined && all.length >= options.limit) {
      return all.slice(0, options.limit);
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { url, key } = loadSupabaseEnv();
  const rows = await fetchPendingPrimaries(url, key, options);

  /** @type {Array<{ id: string; title: string; fromPriority: number; toPriority: number; ruleId: string; ruleLabel: string }>} */
  const patches = [];

  for (const row of rows) {
    const suggestion = suggestEditorialPriority(row);
    if (!suggestion) {
      continue;
    }
    const fromPriority = currentSuggestedPriority(row);
    if (fromPriority === suggestion.priority) {
      continue;
    }
    patches.push({
      id: row.id,
      title: row.title,
      fromPriority,
      toPriority: suggestion.priority,
      ruleId: suggestion.ruleId,
      ruleLabel: suggestion.ruleLabel
    });
  }

  const mode = options.dryRun ? "DRY RUN" : "APPLY";
  console.log(`=== Admin priority triage — ${mode} ===`);
  console.log("");
  console.log(`Scanned: ${rows.length} pending_review primaries`);
  console.log(`Would change: ${patches.length} row(s)`);
  console.log("");

  if (patches.length === 0) {
    console.log("Nothing to do — no rule matched a different priority.");
    return;
  }

  /** @type {Map<string, typeof patches>} */
  const byRule = new Map();
  for (const patch of patches) {
    const bucket = byRule.get(patch.ruleLabel) ?? [];
    bucket.push(patch);
    byRule.set(patch.ruleLabel, bucket);
  }

  for (const [ruleLabel, group] of byRule.entries()) {
    console.log(`${ruleLabel} → P${group[0]?.toPriority} (${group.length})`);
    for (const patch of group.slice(0, 8)) {
      console.log(`  P${patch.fromPriority}→P${patch.toPriority}  ${patch.title}`);
    }
    if (group.length > 8) {
      console.log(`  … +${group.length - 8} more`);
    }
    console.log("");
  }

  if (options.dryRun) {
    console.log("No writes made. Re-run without --dry-run to PATCH suggested_priority.");
    return;
  }

  const grouped = groupPatches(patches);
  let applied = 0;
  for (const [priority, ids] of grouped.entries()) {
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      await supabasePatchPriority(url, key, batch, priority);
      applied += batch.length;
    }
  }

  console.log(`Applied ${applied} patch(es).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
