#!/usr/bin/env node
/**
 * List enabled venue keys by ingest lane (must match venue-lanes.utils.ts).
 *
 * Usage:
 *   node scripts/ingest-venue-lane-keys.mjs direct
 *   node scripts/ingest-venue-lane-keys.mjs browser
 *   node scripts/ingest-venue-lane-keys.mjs all
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BROWSER_RENDERING_STRATEGIES = new Set([
  "listing_then_detail",
  "month_windows_then_detail",
  "scroll_listing_then_detail"
]);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const venuesDir = join(repoRoot, "workers/ingest/src/venues");

/** @param {string} strategy @param {string | undefined} ingestLane */
function laneForVenue(strategy, ingestLane) {
  if (ingestLane === "direct" || ingestLane === "browser") {
    return ingestLane;
  }
  return BROWSER_RENDERING_STRATEGIES.has(strategy) ? "browser" : "direct";
}

/** @param {"direct" | "browser" | "all"} lane */
function listKeys(lane) {
  /** @type {string[]} */
  const keys = [];

  for (const entry of readdirSync(venuesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
      continue;
    }

    const configPath = join(venuesDir, entry.name, "venue.config.json");
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      continue;
    }

    if (config.enabled !== true || typeof config.key !== "string") {
      continue;
    }

    const venueLane = laneForVenue(config.strategy, config.ingestLane);
    if (lane === "all" || lane === venueLane) {
      keys.push(config.key);
    }
  }

  return keys.sort((a, b) => a.localeCompare(b));
}

const laneArg = process.argv[2] ?? "all";
if (laneArg !== "direct" && laneArg !== "browser" && laneArg !== "all") {
  console.error("Usage: ingest-venue-lane-keys.mjs direct|browser|all");
  process.exit(2);
}

console.log(listKeys(laneArg).join(","));
