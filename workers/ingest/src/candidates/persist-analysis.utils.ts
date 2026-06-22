import type { IngestExclusion, NormalizedEvent } from "@fresno-events/shared";
import { getIngestExclusion } from "@fresno-events/shared";

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
import { applyIngestDefaults } from "@/lib/ingest-defaults.utils";
import { visitFresnoPersistAliasKey } from "@/scrapers/visit-fresno-source-id.utils";

/** Normalize scrape rows the same way upsert does before fingerprint/audit comparison. */
function eventForPersistAnalysis(event: NormalizedEvent): NormalizedEvent {
  return applyIngestDefaults(event);
}

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
  ingestExclusion?: IngestExclusion;
}

export interface PersistAnalysisResult {
  analyses: PersistEventAnalysis[];
  summary: PersistAuditSummary;
}

function candidateKey(source: string, sourceEventId: string) {
  return `${source}:${sourceEventId}`;
}

export function resolveExistingCandidate(
  event: NormalizedEvent,
  existingByKey: Map<string, ExistingCandidateRow>
): ExistingCandidateRow | undefined {
  const direct = existingByKey.get(candidateKey(event.source, event.sourceEventId));
  if (direct) {
    return direct;
  }

  const alias = visitFresnoPersistAliasKey(event);
  if (alias) {
    return existingByKey.get(alias);
  }

  return undefined;
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
    const normalized = eventForPersistAnalysis(event);
    const existing = resolveExistingCandidate(event, existingByKey);
    const fingerprint = await contentFingerprint(normalized);
    const exclusion = getIngestExclusion({
      title: event.title,
      descriptionText: event.descriptionText ?? null
    });
    const status = exclusion ? "rejected" : resolveStatusOnRescrape(existing, fingerprint);
    const contentChanged = existing ? fingerprintChanged(existing, fingerprint) : true;
    const exclusionFields = exclusion ? { ingestExclusion: exclusion } : {};

    if (!existing) {
      const item = buildNewAuditItem(normalized);
      auditNew.push(item);
      analyses.push({
        event,
        fingerprint,
        status,
        contentChanged,
        auditKind: "new",
        auditNew: item,
        ...exclusionFields
      });
      continue;
    }

    if (contentChanged) {
      const item = buildChangedAuditItem(
        eventForPersistAnalysis(existing.normalized_event),
        normalized
      );
      auditChanged.push(item);
      analyses.push({
        event,
        existing,
        fingerprint,
        status,
        contentChanged,
        auditKind: "changed",
        auditChanged: item,
        ...exclusionFields
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
      auditKind: "unchanged",
      ...exclusionFields
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
