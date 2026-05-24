import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURE_DIR = "tools/spikes/fixtures";

async function main() {
  const start = new Date();
  const end = new Date(start.getTime() + 120 * 86_400_000);
  const fmtDay = (d) => d.toISOString().slice(0, 10);

  const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
  // Fresno Grizzlies — California League (Single-A), not Triple-A teamId 481.
  url.searchParams.set("teamId", "259");
  url.searchParams.set("sportId", "14");
  url.searchParams.set("startDate", fmtDay(start));
  url.searchParams.set("endDate", fmtDay(end));

  const res = await fetch(url, {
    headers: { "User-Agent": "WhatUpFresnoBot/0.1 (spike)" }
  });

  const body = await res.text();
  console.log(JSON.stringify({
    spike: "milb",
    status: res.status,
    contentType: res.headers.get("content-type"),
    bytes: body.length
  }));

  await mkdir(FIXTURE_DIR, { recursive: true });
  const outPath = join(FIXTURE_DIR, "milb-sample.json");
  await writeFile(outPath, body);

  try {
    const parsed = JSON.parse(body);
    const dates = parsed?.dates ?? [];
    const games = dates.flatMap((d) => d.games ?? []);
    const teamNames = new Set();
    for (const game of games.slice(0, 5)) {
      teamNames.add(game?.teams?.home?.team?.name);
      teamNames.add(game?.teams?.away?.team?.name);
    }
    console.log(JSON.stringify({
      totalDays: dates.length,
      totalGames: games.length,
      sampleTeams: [...teamNames].filter(Boolean),
      firstGameKeys: games[0] ? Object.keys(games[0]) : []
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
