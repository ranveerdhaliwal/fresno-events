#!/usr/bin/env node
/**
 * Report event_candidates / events grouped by occurrence_key (computed) for collision review.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createHash } from "node:crypto";

const PACIFIC = "America/Los_Angeles";
const BUCKET_MINUTES = 30;

function normalizeTitle(title) {
  let value = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  value = value.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return value;
}

function slugifyVenue(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "venue"
  );
}

function pacificBucket(startTs) {
  const instant = new Date(startTs);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  const totalMinutes = Number(get("hour")) * 60 + Number(get("minute"));
  const rounded = Math.round(totalMinutes / BUCKET_MINUTES) * BUCKET_MINUTES;
  const hour = Math.floor(rounded / 60);
  const minute = rounded % 60;
  return `${get("year")}-${get("month")}-${get("day")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function occurrenceKey(row) {
  const bucket = pacificBucket(row.start_ts);
  const title = normalizeTitle(row.title);
  const venue = slugifyVenue(row.venue_name);
  if (!bucket || !title || !venue) {
    return null;
  }
  return createHash("sha256").update(`${title}|${bucket}|${venue}`).digest("hex");
}

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const response = await fetch(
    `${url}/rest/v1/event_candidates?select=id,source,source_event_id,title,venue_name,start_ts,status,occurrence_id&limit=5000`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    }
  );

  if (!response.ok) {
    console.error(await response.text());
    process.exit(1);
  }

  const rows = await response.json();
  const groups = new Map();

  for (const row of rows) {
    const key = row.occurrence_key ?? occurrenceKey(row);
    if (!key) {
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let collisions = 0;
  for (const [key, list] of groups) {
    const sources = new Set(list.map((r) => r.source));
    if (sources.size < 2) {
      continue;
    }
    collisions += 1;
    console.log(`\n# ${key.slice(0, 12)}… (${list.length} rows, ${sources.size} sources)`);
    for (const row of list) {
      console.log(`  - ${row.source} | ${row.status} | ${row.title} | ${row.start_ts}`);
    }
  }

  console.log(`\n${collisions} cross-source collision group(s) in sample.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
