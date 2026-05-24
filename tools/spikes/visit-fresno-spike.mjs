import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TOKEN = "4baba5b9c86a9895b9a3c92d3ec8e985";
const FIXTURE_DIR = "tools/spikes/fixtures";

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

async function main() {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86_400_000);

  // Narrow date window + small page size avoids CMS "max result set" 500.
  const filter = {
    filter: {
      "dates.eventDate": {
        $gte: { $date: formatPacificIso(now) },
        $lte: { $date: formatPacificIso(end) }
      }
    },
    options: {
      skip: 0,
      limit: 50,
      count: true
    }
  };

  const url = new URL("https://www.visitfresnocounty.org/includes/rest_v2/plugins_events_events_by_date/find/");
  url.searchParams.set("json", JSON.stringify(filter));
  url.searchParams.set("token", TOKEN);

  const res = await fetch(url, {
    headers: { "User-Agent": "WhatUpFresnoBot/0.1 (spike)" }
  });

  const body = await res.text();
  console.log(JSON.stringify({
    spike: "visit-fresno",
    status: res.status,
    contentType: res.headers.get("content-type"),
    bytes: body.length
  }));

  await mkdir(FIXTURE_DIR, { recursive: true });
  const outPath = join(FIXTURE_DIR, "visit-fresno-sample.json");
  await writeFile(outPath, body);

  let parsed;
  try {
    parsed = JSON.parse(body);
    const nested = parsed?.docs;
    const docs = Array.isArray(nested) ? nested : nested?.docs;
    console.log(JSON.stringify({
      topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
      docCount: Array.isArray(docs) ? docs.length : null,
      numFound: nested?.count ?? parsed?.numFound ?? parsed?.count,
      firstDocKeys: Array.isArray(docs) && docs[0] ? Object.keys(docs[0]) : []
    }));
  } catch {
    console.log("response is not JSON");
  }

  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
