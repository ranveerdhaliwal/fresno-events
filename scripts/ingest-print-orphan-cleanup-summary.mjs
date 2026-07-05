#!/usr/bin/env node
/**
 * Print a human-readable summary from POST /review/ops/published-orphan-cleanup JSON.
 * Exits 1 when ok !== true or summary.errors > 0.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {number} */
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** @param {unknown} body @returns {number} */
export function printOrphanCleanupSummary(body) {
  if (!isRecord(body)) {
    console.error("Invalid response: expected JSON object.");
    return 1;
  }

  if (body.ok !== true) {
    const message =
      isRecord(body.error) && typeof body.error.message === "string"
        ? body.error.message
        : "Published orphan cleanup failed.";
    console.error(`FAIL: ${message}`);
    if (process.env.INGEST_VERBOSE === "1") {
      console.error(JSON.stringify(body, null, 2));
    }
    return 1;
  }

  const data = isRecord(body.data) ? body.data : {};
  const summary = isRecord(data.summary) ? data.summary : {};
  const dryRun = data.dryRun === true;
  const scheduledScanned = num(summary.scheduledScanned);
  const duplicateGroups = num(summary.duplicateGroups);
  const wouldDelete = num(summary.wouldDelete);
  const deleted = num(summary.deleted);
  const errors = num(summary.errors);
  const deletions = Array.isArray(summary.deletions) ? summary.deletions : [];
  const message = typeof data.message === "string" ? data.message : "";

  const mode = dryRun ? "DRY RUN (no DB writes)" : "APPLIED";
  console.log(`=== Published orphan cleanup — ${mode} ===`);
  console.log("");
  console.log(
    "Removes scheduled events that duplicate another published show (same title, venue, start)."
  );
  console.log("");

  console.log("Scope");
  console.log(`  ${scheduledScanned} scheduled events scanned`);
  console.log(`  ${duplicateGroups} duplicate group(s)`);
  console.log("");

  if (dryRun) {
    console.log(`Would delete ${wouldDelete} orphan row(s), ${errors} error(s)`);
  } else {
    console.log(`Deleted ${deleted} orphan row(s), ${errors} error(s)`);
  }
  console.log("");

  if (deletions.length > 0) {
    console.log("Samples");
    for (const item of deletions.slice(0, 12)) {
      if (!isRecord(item)) {
        continue;
      }
      const title = typeof item.title === "string" ? item.title : "Event";
      const slug = typeof item.slug === "string" ? item.slug : "?";
      const keepSlug = typeof item.keepSlug === "string" ? item.keepSlug : "?";
      console.log(`  ${title}`);
      console.log(`    remove ${slug} → keep ${keepSlug}`);
    }
    if (deletions.length > 12) {
      console.log(`  … and ${deletions.length - 12} more`);
    }
    console.log("");
  }

  if (message) {
    console.log(message);
  }

  if (process.env.INGEST_VERBOSE === "1") {
    console.log("");
    console.log("Full JSON:");
    console.log(JSON.stringify(body, null, 2));
  }

  return errors > 0 ? 1 : 0;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === entry;
}

if (isMainModule()) {
  const raw = readFileSync(0, "utf8").trim();
  if (!raw) {
    console.error("Empty response from published-orphan-cleanup endpoint.");
    process.exit(1);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON from published-orphan-cleanup endpoint.");
    process.exit(1);
  }

  process.exit(printOrphanCleanupSummary(body));
}
