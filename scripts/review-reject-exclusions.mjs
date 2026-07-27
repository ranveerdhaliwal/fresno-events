#!/usr/bin/env node
/**
 * Auto-reject event_candidates that match shared ingest exclusion rules
 * (Shen Yun, Fresno State away games, etc.).
 *
 * Usage:
 *   node scripts/review-reject-exclusions.mjs            # dry-run
 *   node scripts/review-reject-exclusions.mjs --apply      # write changes
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from workers/ingest/.dev.vars).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatIngestExclusionNotes, getIngestExclusion } from "../packages/shared/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PAGE_SIZE = 500;
const PATCH_BATCH_SIZE = 50;
const ACTIVE_STATUSES = ["pending_review", "needs_changes", "awaiting_enrichment"];

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

function loadSupabaseConfig() {
  const devVars = join(REPO_ROOT, "workers/ingest/.dev.vars");
  const url = process.env.SUPABASE_URL ?? readDevVar(devVars, "SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? readDevVar(devVars, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (run pnpm env:status).");
    process.exit(1);
  }
  return { url, key };
}

/** @param {{ url: string, key: string }} supabase @param {string} path */
async function supabaseFetch(supabase, path) {
  const response = await fetch(`${supabase.url}${path}`, {
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase GET failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** @param {{ url: string, key: string }} supabase @param {string} id @param {string} reviewNotes */
async function patchRejected(supabase, id, reviewNotes) {
  const response = await fetch(`${supabase.url}/rest/v1/event_candidates?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      status: "rejected",
      reviewed_by: "ingest",
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) {
    throw new Error(`PATCH ${id} failed: ${response.status} ${await response.text()}`);
  }
}

/** @param {unknown} value */
function normalizedEvent(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return /** @type {{ title?: string, descriptionText?: string | null, source?: string }} */ (value);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = loadSupabaseConfig();

  /** @type {Array<{ id: string, title: string, exclusionId: string, label: string, reviewNotes: string }>} */
  const toReject = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,status,normalized_event",
      status: `in.(${ACTIVE_STATUSES.join(",")})`,
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    const rows = await supabaseFetch(supabase, `/rest/v1/event_candidates?${params}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const event = normalizedEvent(row.normalized_event);
      if (!event?.title) {
        continue;
      }
      const exclusion = getIngestExclusion({
        title: event.title,
        descriptionText: event.descriptionText ?? null,
        source: event.source ?? null
      });
      if (!exclusion) {
        continue;
      }
      toReject.push({
        id: row.id,
        title: event.title,
        exclusionId: exclusion.id,
        label: exclusion.label,
        reviewNotes: formatIngestExclusionNotes(exclusion)
      });
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  if (toReject.length === 0) {
    console.log(`No ingest exclusions in active queue (${ACTIVE_STATUSES.join(", ")}).`);
    return;
  }

  const byRule = new Map();
  for (const row of toReject) {
    byRule.set(row.exclusionId, (byRule.get(row.exclusionId) ?? 0) + 1);
  }

  console.log(`=== Ingest exclusions — ${apply ? "APPLY" : "DRY RUN"} ===`);
  for (const [ruleId, count] of byRule) {
    console.log(`${ruleId}: ${count}`);
  }
  for (const row of toReject.slice(0, 20)) {
    console.log(`  - ${row.title}`);
  }
  if (toReject.length > 20) {
    console.log(`  … and ${toReject.length - 20} more`);
  }

  if (!apply) {
    console.log(`\nDry run: ${toReject.length} candidate(s) would be rejected. Re-run with --apply.`);
    return;
  }

  let applied = 0;
  for (let i = 0; i < toReject.length; i += PATCH_BATCH_SIZE) {
    const batch = toReject.slice(i, i + PATCH_BATCH_SIZE);
    await Promise.all(batch.map((row) => patchRejected(supabase, row.id, row.reviewNotes)));
    applied += batch.length;
  }

  console.log(`\nRejected ${applied} candidate(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
