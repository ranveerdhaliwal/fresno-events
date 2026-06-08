import type { ReviewPriorityTriageOpsResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import {
  currentSuggestedPriority,
  suggestEditorialPriority,
  type TriageCandidateRow
} from "@/routes/review-priority-triage.rules";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

const PAGE_SIZE = 500;
const PATCH_BATCH_SIZE = 50;

export interface PriorityTriageOptions {
  dryRun?: boolean;
  sourceFilter?: string;
  limit?: number;
}

interface PriorityTriagePatch {
  id: string;
  title: string;
  fromPriority: number;
  toPriority: number;
  ruleId: string;
  ruleLabel: string;
}

async function fetchPendingPrimaries(
  env: Env,
  options: PriorityTriageOptions
): Promise<TriageCandidateRow[]> {
  const all: TriageCandidateRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: "id,title,venue_name,source,suggested_priority,status",
      status: "eq.pending_review",
      canonical_candidate_id: "is.null",
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (options.sourceFilter) {
      params.set("source", `eq.${options.sourceFilter}`);
    }

    const page = await supabaseReviewRequest<TriageCandidateRow[]>(
      env,
      `/rest/v1/event_candidates?${params}`
    );
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

function buildPatches(rows: TriageCandidateRow[]): PriorityTriagePatch[] {
  const patches: PriorityTriagePatch[] = [];

  for (const row of rows) {
    const suggestion = suggestEditorialPriority(row);
    if (!suggestion) {
      continue;
    }
    const fromPriority = currentSuggestedPriority(row);
    if (fromPriority === suggestion.priority) {
      continue;
    }
    patches.push({
      id: row.id,
      title: row.title,
      fromPriority,
      toPriority: suggestion.priority,
      ruleId: suggestion.ruleId,
      ruleLabel: suggestion.ruleLabel
    });
  }

  return patches;
}

function groupByRule(patches: PriorityTriagePatch[]) {
  const byRule = new Map<string, PriorityTriagePatch[]>();
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

function buildMessage(
  dryRun: boolean,
  scanned: number,
  patches: PriorityTriagePatch[],
  applied: number,
  errors: number
): string {
  const mode = dryRun ? "Preview — no database writes" : "Applied";
  const lines = [
    `Priority triage (${mode})`,
    `Scanned ${scanned} pending primaries`,
    `${dryRun ? "Would update" : "Updated"} ${dryRun ? patches.length : applied} row(s)`
  ];

  if (patches.length === 0) {
    lines.push("No rule matched a different priority.");
    return lines.join("\n");
  }

  for (const group of groupByRule(patches)) {
    lines.push(`${group.ruleLabel} → P${group.toPriority} (${group.count})`);
    for (const sample of group.samples) {
      lines.push(`  ${sample}`);
    }
    if (group.count > group.samples.length) {
      lines.push(`  … +${group.count - group.samples.length} more`);
    }
  }

  if (!dryRun) {
    lines.push(`Errors: ${errors}`);
  } else {
    lines.push("Run Apply to patch suggested_priority.");
  }

  return lines.join("\n");
}

async function applyPatches(env: Env, patches: PriorityTriagePatch[]): Promise<{ applied: number; errors: number }> {
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
        await supabaseReviewRequest(env, `/rest/v1/event_candidates?id=in.(${idList})`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            suggested_priority: priority,
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

export async function runPriorityTriageOps(
  env: Env,
  options: PriorityTriageOptions = {}
): Promise<ReviewPriorityTriageOpsResponse> {
  const dryRun = options.dryRun ?? false;
  const rows = await fetchPendingPrimaries(env, options);
  const patches = buildPatches(rows);
  const byRule = groupByRule(patches);

  if (dryRun) {
    return {
      dryRun: true,
      summary: {
        scanned: rows.length,
        wouldChange: patches.length,
        applied: 0,
        errors: 0
      },
      byRule,
      message: buildMessage(true, rows.length, patches, 0, 0)
    };
  }

  const { applied, errors } = await applyPatches(env, patches);
  return {
    dryRun: false,
    summary: {
      scanned: rows.length,
      wouldChange: patches.length,
      applied,
      errors
    },
    byRule,
    message: buildMessage(false, rows.length, patches, applied, errors)
  };
}
