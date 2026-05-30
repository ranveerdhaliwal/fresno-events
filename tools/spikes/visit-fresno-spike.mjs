import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURE_DIR = "tools/spikes/fixtures";
const TOKEN_URL = "https://www.visitfresnocounty.org/plugins/core/get_simple_token/";
const EVENTS_URL =
  "https://www.visitfresnocounty.org/includes/rest_v2/plugins_events_events_by_date/find/";

function formatPacificIso(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-07:00`;
}

function buildWeeklyRanges(now, windowDays = 7, horizonDays = 30) {
  const ranges = [];
  const windowMs = windowDays * 86_400_000;
  const endHorizon = now.getTime() + horizonDays * 86_400_000;

  for (let startMs = now.getTime(); startMs < endHorizon; startMs += windowMs) {
    ranges.push({
      start: new Date(startMs),
      end: new Date(Math.min(startMs + windowMs - 1, endHorizon))
    });
  }

  return ranges;
}

function parseToken(body) {
  const trimmed = body.trim();
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

async function fetchEventsPage(token, range, skip = 0, limit = 50) {
  const filter = {
    filter: {
      "dates.eventDate": {
        $gte: { $date: formatPacificIso(range.start) },
        $lte: { $date: formatPacificIso(range.end) }
      }
    },
    options: {
      skip,
      limit,
      count: true
    }
  };

  const url = new URL(EVENTS_URL);
  url.searchParams.set("json", JSON.stringify(filter));
  url.searchParams.set("token", token);

  const res = await fetch(url, {
    headers: { "User-Agent": "WhatUpFresnoBot/0.1 (spike)" }
  });

  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    body: await res.text()
  };
}

async function main() {
  const tokenRes = await fetch(TOKEN_URL, {
    headers: { "User-Agent": "WhatUpFresnoBot/0.1 (spike)" }
  });
  const token = parseToken(await tokenRes.text());

  console.log(
    JSON.stringify({
      spike: "visit-fresno-token",
      status: tokenRes.status,
      token_ok: Boolean(token)
    })
  );

  if (!token) {
    console.error("Could not parse token from get_simple_token");
    process.exit(1);
  }

  const [firstRange] = buildWeeklyRanges(new Date());
  if (!firstRange) {
    throw new Error("No date ranges");
  }

  const page = await fetchEventsPage(token, firstRange);
  console.log(
    JSON.stringify({
      spike: "visit-fresno",
      status: page.status,
      contentType: page.contentType,
      bytes: page.body.length,
      rangeStart: firstRange.start.toISOString().slice(0, 10),
      rangeEnd: firstRange.end.toISOString().slice(0, 10)
    })
  );

  await mkdir(FIXTURE_DIR, { recursive: true });
  const outPath = join(FIXTURE_DIR, "visit-fresno-sample.json");
  await writeFile(outPath, page.body);

  try {
    const parsed = JSON.parse(page.body);
    const nested = parsed?.docs;
    const docs = Array.isArray(nested) ? nested : nested?.docs;
    console.log(
      JSON.stringify({
        topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
        docCount: Array.isArray(docs) ? docs.length : null,
        numFound: nested?.count ?? parsed?.numFound ?? parsed?.count,
        firstDocKeys: Array.isArray(docs) && docs[0] ? Object.keys(docs[0]) : []
      })
    );
  } catch {
    console.log("response is not JSON");
    process.exit(1);
  }

  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
