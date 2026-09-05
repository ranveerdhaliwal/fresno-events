#!/usr/bin/env node
/**
 * Cancel published events that match shared ingest exclusion rules
 * (Shen Yun, certification bootcamps, franchise scavenger hunts, etc.).
 *
 * Usage:
 *   node scripts/published-reject-exclusions.mjs            # dry-run
 *   node scripts/published-reject-exclusions.mjs --apply      # write changes
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
const PUBLIC_STATUSES = ["scheduled", "sold_out", "postponed"];

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

/** @param {{ url: string, key: string }} supabase @param {string} id */
async function patchCancelled(supabase, id) {
  const response = await fetch(`${supabase.url}/rest/v1/events?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) {
    throw new Error(`PATCH ${id} failed: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = loadSupabaseConfig();

  /** @type {Array<{ id: string, title: string, slug: string, exclusionId: string, label: string, reviewNotes: string }>} */
  const toCancel = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,slug,title,description_text,source,status",
      status: `in.(${PUBLIC_STATUSES.join(",")})`,
      order: "start_ts.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    const rows = await supabaseFetch(supabase, `/rest/v1/events?${params}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const title = typeof row.title === "string" ? row.title : "";
      if (!title) {
        continue;
      }
      const exclusion = getIngestExclusion({
        title,
        descriptionText: typeof row.description_text === "string" ? row.description_text : null,
        source: typeof row.source === "string" ? row.source : null
      });
      if (!exclusion) {
        continue;
      }
      toCancel.push({
        id: row.id,
        title,
        slug: typeof row.slug === "string" ? row.slug : "",
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

  if (toCancel.length === 0) {
    console.log(`No published exclusions in active events (${PUBLIC_STATUSES.join(", ")}).`);
    return;
  }

  const byRule = new Map();
  for (const row of toCancel) {
    byRule.set(row.exclusionId, (byRule.get(row.exclusionId) ?? 0) + 1);
  }

  console.log(`=== Published exclusions — ${apply ? "APPLY" : "DRY RUN"} ===`);
  for (const [ruleId, count] of byRule) {
    console.log(`  ${ruleId}: ${count}`);
  }
  console.log(`Total: ${toCancel.length}`);
  console.log("");
  for (const row of toCancel.slice(0, 25)) {
    console.log(`  · ${row.title} (${row.slug}) — ${row.label}`);
  }
  if (toCancel.length > 25) {
    console.log(`  … and ${toCancel.length - 25} more`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to cancel matching published events.");
    return;
  }

  for (let i = 0; i < toCancel.length; i += PATCH_BATCH_SIZE) {
    const batch = toCancel.slice(i, i + PATCH_BATCH_SIZE);
    await Promise.all(batch.map((row) => patchCancelled(supabase, row.id)));
    console.log(`Cancelled ${Math.min(i + PATCH_BATCH_SIZE, toCancel.length)} / ${toCancel.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
