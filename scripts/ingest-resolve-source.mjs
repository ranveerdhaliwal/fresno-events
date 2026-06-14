#!/usr/bin/env node
/**
 * Resolve a user-facing ingest --source= value to worker scraper + optional venue filter.
 *
 * Each venue module declares `promoteSource` in venue.config.json (e.g. visitfresnocounty).
 * API scrapers: ticketmaster, venunite (workers/ingest/src/registry.ts).
 *
 * Usage:
 *   node scripts/ingest-resolve-source.mjs visitfresnocounty
 *   node scripts/ingest-resolve-source.mjs --all-venues
 *   node scripts/ingest-list-sources.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const venuesDir = join(repoRoot, "workers/ingest/src/venues");

const API_SCRAPERS = [
  { promoteSource: "ticketmaster", scraper: "ticketmaster", label: "Ticketmaster Discovery API" },
  { promoteSource: "venunite", scraper: "venunite", label: "VenuNite aggregator API" }
];

const API_SCRAPER_KEYS = new Set([...API_SCRAPERS.map((s) => s.promoteSource), "all"]);

/** @typedef {{ key: string, promoteSource: string, label: string, eventSource?: string }} VenueModule */

/** @type {Map<string, string>} promote alias → venue module key */
const aliasToVenueKey = new Map();

/** @type {VenueModule[]} */
let venueModules = [];

function registerAlias(alias, venueKey) {
  const normalized = alias.trim().toLowerCase();
  if (!normalized || aliasToVenueKey.has(normalized)) {
    return;
  }
  aliasToVenueKey.set(normalized, venueKey);
}

function loadVenueModules() {
  /** @type {VenueModule[]} */
  const modules = [];

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
    if (config.enabled !== true || typeof config.key !== "string" || typeof config.promoteSource !== "string") {
      continue;
    }
    modules.push({
      key: config.key,
      promoteSource: config.promoteSource,
      label: typeof config.label === "string" ? config.label : config.key,
      ...(typeof config.eventSource === "string" ? { eventSource: config.eventSource } : {})
    });
  }

  modules.sort((a, b) => a.promoteSource.localeCompare(b.promoteSource));
  venueModules = modules;

  aliasToVenueKey.clear();
  for (const mod of modules) {
    registerAlias(mod.promoteSource, mod.key);
    registerAlias(mod.key, mod.key);
    if (mod.eventSource) {
      registerAlias(mod.eventSource, mod.key);
      if (mod.eventSource.includes(":")) {
        registerAlias(mod.eventSource.split(":").slice(1).join(":"), mod.key);
      }
    }
  }
}

loadVenueModules();

/** @returns {{ promoteSource: string, label: string, kind: "api" | "venue", eventSource?: string, venueKey?: string }[]} */
export function listPromoteSources() {
  const venues = venueModules.map((mod) => ({
    promoteSource: mod.promoteSource,
    label: mod.label,
    kind: /** @type {const} */ ("venue"),
    venueKey: mod.key,
    ...(mod.eventSource ? { eventSource: mod.eventSource } : {})
  }));

  const api = API_SCRAPERS.map((mod) => ({
    promoteSource: mod.promoteSource,
    label: mod.label,
    kind: /** @type {const} */ ("api")
  }));

  return [...api, ...venues].sort((a, b) => a.promoteSource.localeCompare(b.promoteSource));
}

/** @param {string} part */
function resolveOne(part) {
  const trimmed = part.trim();
  if (!trimmed) {
    throw new Error("Empty source in comma-separated list.");
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === "venue-ingest") {
    throw new Error(
      "venue-ingest is internal. Use pnpm ingest:promote-all for every venue source, or --source=<name> for one."
    );
  }
  if (API_SCRAPER_KEYS.has(normalized)) {
    return { scraper: normalized, venues: [], part: trimmed };
  }
  const venueKey = aliasToVenueKey.get(normalized);
  if (!venueKey) {
    const known = listPromoteSources()
      .map((s) => s.promoteSource)
      .join(", ");
    throw new Error(`Unknown source "${trimmed}". Known: ${known}, or pnpm ingest:promote-all`);
  }
  return { scraper: "venue-ingest", venues: [venueKey], part: trimmed };
}

/**
 * @param {string} input
 * @param {{ allVenues?: boolean }} options
 */
export function resolveIngestSource(input, options = {}) {
  if (options.allVenues || input === "--all-venues") {
    return {
      display: "all venues",
      runs: [{ scraper: "venue-ingest", venues: [] }]
    };
  }

  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Source is required.");
  }

  const resolved = parts.map(resolveOne);
  const apiRuns = resolved.filter((r) => r.scraper !== "venue-ingest");
  const venueRuns = resolved.filter((r) => r.scraper === "venue-ingest");

  if (apiRuns.length > 0 && venueRuns.length > 0) {
    throw new Error("Mix ticketmaster/venunite with other sources in separate promote commands.");
  }

  if (apiRuns.length > 0) {
    const scrapers = [...new Set(apiRuns.map((r) => r.scraper))];
    return {
      display: parts.join(","),
      runs: [{ scraper: scrapers.join(","), venues: [] }]
    };
  }

  const venues = [...new Set(venueRuns.flatMap((r) => r.venues))].sort((a, b) => a.localeCompare(b));
  return {
    display: parts.length === 1 ? parts[0] : parts.join(","),
    runs: [{ scraper: "venue-ingest", venues }]
  };
}

function shellEscape(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function main() {
  const jsonMode = process.argv.includes("--json");
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const input = args[0] ?? "";
  const allVenues = input === "--all-venues" || args.includes("--all-venues");

  try {
    const result = resolveIngestSource(input, { allVenues });
    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const run = result.runs[0];
    if (!run) {
      throw new Error("No runnable source resolved.");
    }
    const venueFilter = run.venues.join(",");
    console.log(`INGEST_DISPLAY_SOURCE=${shellEscape(result.display)}`);
    console.log(`INGEST_SCRAPER=${shellEscape(run.scraper)}`);
    console.log(`INGEST_VENUE_FILTER=${shellEscape(venueFilter)}`);
    console.log(`INGEST_RUN_COUNT=${result.runs.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(2);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
