#!/usr/bin/env node
/**
 * Print a human-readable summary from POST /occurrence-relink/trigger JSON.
 * Usage: curl ... | node scripts/ingest-print-relink-summary.mjs
 * Exits 1 when ok !== true or summary.errors > 0.
 */

import { readFileSync } from "node:fs";

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {number} */
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** @param {unknown} body */
function printRelinkSummary(body) {
  if (!isRecord(body)) {
    console.error("Invalid response: expected JSON object.");
    return 1;
  }

  if (body.ok !== true) {
    const message =
      isRecord(body.error) && typeof body.error.message === "string"
        ? body.error.message
        : typeof body.message === "string"
          ? body.message
          : "Occurrence relink failed.";
    console.error(`FAIL: ${message}`);
    if (process.env.INGEST_VERBOSE === "1") {
      console.error(JSON.stringify(body, null, 2));
    }
    return 1;
  }

  const data = isRecord(body.data) ? body.data : {};
  const summary = isRecord(data.summary) ? data.summary : {};
  const dryRun = summary.dry_run === true || data.dry_run === true;
  const sourceFilter = typeof data.source === "string" ? data.source : undefined;

  const candidates = num(summary.candidates);
  const relinkable = num(summary.relinkable);
  const skippedRejected = num(summary.skipped_rejected);
  const groups = num(summary.groups);
  const multiSourceGroups = num(summary.multi_source_groups);
  const changed = num(summary.changed);
  const unchanged = num(summary.unchanged);
  const applied = num(summary.applied);
  const errors = num(summary.errors);
  const linkedAsDuplicate = num(summary.linked_as_duplicate);
  const promoted = num(summary.promoted_from_duplicate);
  const demoted = num(summary.demoted_to_duplicate);
  const keyChanged = num(summary.occurrence_key_changed);
  const idChanged = num(summary.occurrence_id_changed);
  const priorityInherited = num(summary.priority_inherited);

  const mode = dryRun ? "DRY RUN (no DB writes)" : "APPLIED";
  console.log(`=== Occurrence relink — ${mode} ===`);
  console.log("");
  console.log(
    "Recomputes show-night keys (occurrence_key / occurrence_id) and cross-source duplicate links."
  );
  if (sourceFilter) {
    console.log(`Source filter: ${sourceFilter}`);
  }
  console.log("");

  console.log("Scope");
  console.log(`  ${candidates} candidates (${relinkable} relinkable, ${skippedRejected} rejected skipped)`);
  console.log(`  ${groups} distinct show occurrences (${multiSourceGroups} with multiple sources)`);
  console.log("");

  console.log(dryRun ? "Would change" : "Changes");
  console.log(`  ${changed} rows ${dryRun ? "need updates" : "updated"}, ${unchanged} already correct`);
  if (!dryRun) {
    console.log(`  ${applied} patches applied, ${errors} errors`);
  }
  console.log("");

  console.log("Duplicate linking (after plan)");
  console.log(`  ${linkedAsDuplicate} linked as duplicate of another source`);
  console.log(`  ${promoted} duplicate → primary promotions`);
  console.log(`  ${demoted} demoted to duplicate`);
  console.log("");

  if (keyChanged > 0 || idChanged > 0 || priorityInherited > 0) {
    console.log("Key migrations");
    if (keyChanged > 0) {
      console.log(`  ${keyChanged} occurrence_key changes`);
    }
    if (idChanged > 0) {
      console.log(`  ${idChanged} occurrence_id changes`);
    }
    if (priorityInherited > 0) {
      console.log(`  ${priorityInherited} primary priority inheritances`);
    }
    console.log("");
  }

  if (dryRun) {
    console.log(`No writes made. Re-run without --dry-run to apply ${changed} update(s).`);
  } else if (changed === 0) {
    console.log("Nothing to do — all candidates already match current matching rules.");
  } else if (errors === 0) {
    console.log(`Done — ${applied} row(s) patched.`);
  } else {
    console.log(`Finished with ${errors} error(s); check ingest worker logs.`);
  }

  if (process.env.INGEST_VERBOSE === "1") {
    console.log("");
    console.log("Full JSON:");
    console.log(JSON.stringify(body, null, 2));
  }

  return errors > 0 ? 1 : 0;
}

const raw = readFileSync(0, "utf8").trim();
if (!raw) {
  console.error("Empty response from occurrence-relink endpoint.");
  process.exit(1);
}

let body;
try {
  body = JSON.parse(raw);
} catch {
  console.error("Invalid JSON from occurrence-relink endpoint.");
  process.exit(1);
}

process.exit(printRelinkSummary(body));
