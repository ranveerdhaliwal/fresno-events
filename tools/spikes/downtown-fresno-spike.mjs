import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURE_DIR = "tools/spikes/fixtures";

function fmt(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${String(d.getFullYear()).slice(2)}`;
}

async function main() {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 86_400_000);
  const window = `${fmt(now)}-to-${fmt(end)}`;

  const url = new URL("https://xapi.citylightstudio.net/_bbq/_bbq_results.php");
  url.searchParams.set("fid", "22");
  url.searchParams.set("key", "050243126");
  url.searchParams.set("bbqparam", window);

  const res = await fetch(url, {
    headers: { "User-Agent": "WhatUpFresnoBot/0.1 (spike)" }
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  console.log(JSON.stringify({
    spike: "downtown-fresno",
    status: res.status,
    contentType,
    window,
    bytes: body.length
  }));

  await mkdir(FIXTURE_DIR, { recursive: true });
  const ext = contentType.includes("json") ? "json" : "html";
  const outPath = join(FIXTURE_DIR, `downtown-fresno-sample.${ext}`);
  await writeFile(outPath, body);
  console.log(`wrote ${outPath}`);

  if (ext === "json") {
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify({
        topLevelKeys: typeof parsed === "object" && parsed ? Object.keys(parsed) : [],
        sample: Array.isArray(parsed) ? parsed[0] : parsed
      }));
    } catch {
      console.log("json parse failed");
    }
  } else {
    console.log(body.slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
