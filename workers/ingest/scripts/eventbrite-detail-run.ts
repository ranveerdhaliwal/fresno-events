#!/usr/bin/env tsx
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { runEventbriteDetailBackfill } from "../src/eventbrite-detail-backfill";

function loadDevVars(): Record<string, string> {
  const repoRoot = join(import.meta.dirname, "../../..");
  const devVarsPath = join(repoRoot, "workers/ingest/.dev.vars");
  const out: Record<string, string> = {};

  if (!existsSync(devVarsPath)) {
    return out;
  }

  for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

function parseArgs(argv: string[]) {
  const options: {
    dryRun: boolean;
    limit?: number;
    delayMs?: number;
    url?: string;
    candidateId?: string;
    matchCandidate: boolean;
    retryBlocked: boolean;
    urlsFile?: string;
  } = {
    dryRun: false,
    matchCandidate: false,
    retryBlocked: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--match-candidate") {
      options.matchCandidate = true;
      continue;
    }
    if (arg === "--retry-blocked") {
      options.retryBlocked = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[++index]);
      continue;
    }
    if (arg.startsWith("--delay=")) {
      options.delayMs = Number(arg.slice("--delay=".length));
      continue;
    }
    if (arg === "--delay") {
      options.delayMs = Number(argv[++index]);
      continue;
    }
    if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length);
      continue;
    }
    if (arg === "--url") {
      options.url = argv[++index];
      continue;
    }
    if (arg.startsWith("--candidate-id=")) {
      options.candidateId = arg.slice("--candidate-id=".length);
      continue;
    }
    if (arg === "--candidate-id") {
      options.candidateId = argv[++index];
      continue;
    }
    if (arg.startsWith("--urls-file=")) {
      options.urlsFile = arg.slice("--urls-file=".length);
      continue;
    }
    if (arg === "--urls-file") {
      options.urlsFile = argv[++index];
      continue;
    }
  }

  return options;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const devVars = loadDevVars();

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL ?? devVars.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? devVars.SUPABASE_SERVICE_ROLE_KEY,
    USER_AGENT: process.env.USER_AGENT ?? devVars.USER_AGENT
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (.dev.vars or env).");
    process.exit(1);
  }

  if (args.urlsFile) {
    const urls = readFileSync(args.urlsFile, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index]!;
      console.log(`[eventbrite:detail] file ${index + 1}/${urls.length}: ${url}`);
      const summary = await runEventbriteDetailBackfill(env, {
        dryRun: args.dryRun,
        url,
        matchCandidate: true,
        limit: 1,
        ...(args.delayMs ? { delayMs: args.delayMs } : {})
      });
      console.log(JSON.stringify(summary, null, 2));
    }
    return;
  }

  const summary = await runEventbriteDetailBackfill(env, {
    dryRun: args.dryRun,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    ...(args.delayMs !== undefined ? { delayMs: args.delayMs } : {}),
    ...(args.url ? { url: args.url } : {}),
    ...(args.candidateId ? { candidateId: args.candidateId } : {}),
    ...(args.matchCandidate ? { matchCandidate: true } : {}),
    ...(args.retryBlocked ? { retryBlocked: true } : {})
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
