import { suggestEventPriority, type ReviewPriorityRerankOpsResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

const PAGE_SIZE = 500;
const PATCH_BATCH_SIZE = 50;

export interface PriorityRerankOptions {
  dryRun?: boolean;
  sourceFilter?: string;
  limit?: number;
  /** When true, only patch event_candidates. When false and eventsOnly false, both tables. */
  candidatesOnly?: boolean;
  eventsOnly?: boolean;
}

interface PriorityRerankPatch {
  id: string;
  title: string;
  fromPriority: number;
  toPriority: number;
  ruleLabel: string;
}

interface CandidateRow {
  id: string;
  title: string;
  venue_name: string;
  source: string;
  suggested_priority: number | null;
}

interface EventRow {
  id: string;
  title: string;
  source: string;
  priority: number;
  venues: { name: string } | null;
}

function currentSuggestedPriority(value: number | null): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return 5;
}

function buildPatches(
  rows: Array<{ id: string; title: string; source: string; venueName: string; fromPriority: number }>
): PriorityRerankPatch[] {
  const patches: PriorityRerankPatch[] = [];

  for (const row of rows) {
    const suggestion = suggestEventPriority({
      source: row.source,
      title: row.title,
      venueName: row.venueName
    });
    if (!suggestion || row.fromPriority === suggestion.priority) {
      continue;
    }
    patches.push({
      id: row.id,
      title: row.title,
      fromPriority: row.fromPriority,
      toPriority: suggestion.priority,
      ruleLabel: suggestion.ruleLabel
    });
  }

  return patches;
}

function groupByRule(patches: PriorityRerankPatch[]) {
  const byRule = new Map<string, PriorityRerankPatch[]>();
  for (const patch of patches) {
    const bucket = byRule.get(patch.ruleLabel) ?? [];
    bucket.push(patch);
    byRule.set(patch.ruleLabel, bucket);
  }

  return [...byRule.entries()].map(([ruleLabel, group]) => ({
    ruleLabel,
    toPriority: group[0]?.toPriority ?? 5,
    count: group.length,
    samples: group.slice(0, 6).map((patch) => `P${patch.fromPriority}→P${patch.toPriority} · ${patch.title}`)
  }));
}

function emptySection() {
  return {
    summary: { scanned: 0, wouldChange: 0, applied: 0, errors: 0 },
    byRule: []
  };
}

function buildSectionMessage(label: string, dryRun: boolean, scanned: number, patches: PriorityRerankPatch[], applied: number) {
  const lines = [
    `${label}: scanned ${scanned}, ${dryRun ? "would change" : "updated"} ${dryRun ? patches.length : applied}`
  ];
  for (const group of groupByRule(patches)) {
    lines.push(`  ${group.ruleLabel} → P${group.toPriority} (${group.count})`);
    for (const sample of group.samples) {
      lines.push(`    ${sample}`);
    }
    if (group.count > group.samples.length) {
      lines.push(`    … +${group.count - group.samples.length} more`);
    }
  }
  return lines;
}

async function fetchPendingPrimaries(env: Env, options: PriorityRerankOptions): Promise<CandidateRow[]> {
  const all: CandidateRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,title,venue_name,source,suggested_priority",
      status: "eq.pending_review",
      canonical_candidate_id: "is.null",
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (options.sourceFilter) {
      params.set("source", `eq.${options.sourceFilter}`);
    }

    const page = await supabaseReviewRequest<CandidateRow[]>(env, `/rest/v1/event_candidates?${params}`);
    all.push(...page);

    if (options.limit !== undefined && all.length >= options.limit) {
      return all.slice(0, options.limit);
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

async function fetchPublishedEvents(env: Env, options: PriorityRerankOptions): Promise<EventRow[]> {
  const all: EventRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,title,source,priority,venues(name)",
      source: "not.in.(manual)",
      order: "start_ts.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (options.sourceFilter) {
      params.set("source", `eq.${options.sourceFilter}`);
    }

    const page = await supabaseReviewRequest<EventRow[]>(env, `/rest/v1/events?${params}`);
    all.push(...page);

    if (options.limit !== undefined && all.length >= options.limit) {
      return all.slice(0, options.limit);
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

async function applyPatches(
  env: Env,
  tablePath: string,
  column: "suggested_priority" | "priority",
  patches: PriorityRerankPatch[]
): Promise<{ applied: number; errors: number }> {
  const byPriority = new Map<number, string[]>();
  for (const patch of patches) {
    const ids = byPriority.get(patch.toPriority) ?? [];
    ids.push(patch.id);
    byPriority.set(patch.toPriority, ids);
  }

  let applied = 0;
  let errors = 0;

  for (const [priority, ids] of byPriority.entries()) {
    for (let offset = 0; offset < ids.length; offset += PATCH_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + PATCH_BATCH_SIZE);
      const idList = batch.join(",");
      try {
        await supabaseReviewRequest(env, `${tablePath}?id=in.(${idList})`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            [column]: priority,
            updated_at: new Date().toISOString()
          })
        });
        applied += batch.length;
      } catch {
        errors += batch.length;
      }
    }
  }

  return { applied, errors };
}

async function rerankCandidates(env: Env, options: PriorityRerankOptions) {
  const rows = await fetchPendingPrimaries(env, options);
  const patches = buildPatches(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      venueName: row.venue_name ?? "",
      fromPriority: currentSuggestedPriority(row.suggested_priority)
    }))
  );

  if (options.dryRun) {
    return {
      summary: { scanned: rows.length, wouldChange: patches.length, applied: 0, errors: 0 },
      byRule: groupByRule(patches),
      patches
    };
  }

  const { applied, errors } = await applyPatches(env, "/rest/v1/event_candidates", "suggested_priority", patches);
  return {
    summary: { scanned: rows.length, wouldChange: patches.length, applied, errors },
    byRule: groupByRule(patches),
    patches
  };
}

async function rerankEvents(env: Env, options: PriorityRerankOptions) {
  const rows = await fetchPublishedEvents(env, options);
  const eligible = rows.filter((row) => !row.source.startsWith("manual:"));
  const patches = buildPatches(
    eligible.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      venueName: row.venues?.name ?? "",
      fromPriority: currentSuggestedPriority(row.priority)
    }))
  );

  if (options.dryRun) {
    return {
      summary: { scanned: eligible.length, wouldChange: patches.length, applied: 0, errors: 0 },
      byRule: groupByRule(patches),
      patches
    };
  }

  const { applied, errors } = await applyPatches(env, "/rest/v1/events", "priority", patches);
  return {
    summary: { scanned: eligible.length, wouldChange: patches.length, applied, errors },
    byRule: groupByRule(patches),
    patches
  };
}

export async function runPriorityRerankOps(
  env: Env,
  options: PriorityRerankOptions = {}
): Promise<ReviewPriorityRerankOpsResponse> {
  const dryRun = options.dryRun ?? false;
  const runCandidates = !options.eventsOnly;
  const runEvents = !options.candidatesOnly;

  const candidateResult = runCandidates ? await rerankCandidates(env, { ...options, dryRun }) : null;
  const eventResult = runEvents ? await rerankEvents(env, { ...options, dryRun }) : null;

  const candidates = candidateResult
    ? { summary: candidateResult.summary, byRule: candidateResult.byRule }
    : emptySection();
  const events = eventResult ? { summary: eventResult.summary, byRule: eventResult.byRule } : emptySection();

  const mode = dryRun ? "Preview — no database writes" : "Applied";
  const lines = [`Priority rerank (${mode})`, ""];

  if (runCandidates) {
    lines.push(...buildSectionMessage("Pending candidates", dryRun, candidates.summary.scanned, candidateResult?.patches ?? [], candidates.summary.applied));
    lines.push("");
  }
  if (runEvents) {
    lines.push(...buildSectionMessage("Published events (excl. manual)", dryRun, events.summary.scanned, eventResult?.patches ?? [], events.summary.applied));
  }

  const totalWouldChange = candidates.summary.wouldChange + events.summary.wouldChange;
  if (totalWouldChange === 0) {
    lines.push("No rule matched a different priority.");
  } else if (dryRun) {
    lines.push("Run Apply to patch priorities.");
  }

  return {
    dryRun,
    candidates,
    events,
    message: lines.join("\n").trimEnd()
  };
}
