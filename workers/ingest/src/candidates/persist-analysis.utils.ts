import type { NormalizedEvent } from "@fresno-events/shared";

import {
  contentFingerprint,
  fingerprintChanged,
  resolveStatusOnRescrape,
  type ExistingCandidateRow
} from "@/candidates/content-fingerprint.utils";
import {
  buildChangedAuditItem,
  buildNewAuditItem,
  buildPersistAuditSummary,
  type PersistAuditItemChanged,
  type PersistAuditItemNew,
  type PersistAuditSummary
} from "@/candidates/persist-audit.utils";

export type PersistEventAuditKind = "new" | "changed" | "unchanged";

export interface PersistEventAnalysis {
  event: NormalizedEvent;
  existing?: ExistingCandidateRow;
  fingerprint: string;
  status: string;
  contentChanged: boolean;
  auditKind: PersistEventAuditKind;
  auditNew?: PersistAuditItemNew;
  auditChanged?: PersistAuditItemChanged;
}

export interface PersistAnalysisResult {
  analyses: PersistEventAnalysis[];
  summary: PersistAuditSummary;
}

function candidateKey(source: string, sourceEventId: string) {
  return `${source}:${sourceEventId}`;
}

export async function analyzeEventsForPersist(
  events: NormalizedEvent[],
  existingByKey: Map<string, ExistingCandidateRow>
): Promise<PersistAnalysisResult> {
  const analyses: PersistEventAnalysis[] = [];
  const auditNew: PersistAuditItemNew[] = [];
  const auditChanged: PersistAuditItemChanged[] = [];
  let unchanged = 0;

  for (const event of events) {
    const existing = existingByKey.get(candidateKey(event.source, event.sourceEventId));
    const fingerprint = await contentFingerprint(event);
    const status = resolveStatusOnRescrape(existing, fingerprint);
    const contentChanged = existing ? fingerprintChanged(existing, fingerprint) : true;

    if (!existing) {
      const item = buildNewAuditItem(event);
      auditNew.push(item);
      analyses.push({
        event,
        fingerprint,
        status,
        contentChanged,
        auditKind: "new",
        auditNew: item
      });
      continue;
    }

    if (contentChanged) {
      const item = buildChangedAuditItem(existing.normalized_event, event);
      auditChanged.push(item);
      analyses.push({
        event,
        existing,
        fingerprint,
        status,
        contentChanged,
        auditKind: "changed",
        auditChanged: item
      });
      continue;
    }

    unchanged += 1;
    analyses.push({
      event,
      existing,
      fingerprint,
      status,
      contentChanged,
      auditKind: "unchanged"
    });
  }

  return {
    analyses,
    summary: buildPersistAuditSummary({
      newItems: auditNew,
      changedItems: auditChanged,
      unchangedCount: unchanged
    })
  };
}

export function mergePersistAuditSummaries(summaries: PersistAuditSummary[]): PersistAuditSummary {
  const newItems = summaries.flatMap((summary) => summary.new_items);
  const changedItems = summaries.flatMap((summary) => summary.changed_items);
  const batchDuplicateItems = summaries.flatMap((summary) => summary.batch_duplicate_items ?? []);

  return buildPersistAuditSummary({
    newItems,
    changedItems,
    unchangedCount: summaries.reduce((total, summary) => total + summary.unchanged, 0),
    batchDuplicateItems
  });
}
