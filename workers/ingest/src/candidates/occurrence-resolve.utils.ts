import type { NormalizedEvent } from "@fresno-events/shared";
import { computeOccurrenceFingerprints, sourcePriorityRank } from "@fresno-events/shared";

import type {
  OccurrenceMatchCandidate,
  OccurrenceMatchEvent,
  OccurrenceMatchIndex,
  OccurrenceMatchStep
} from "@/candidates/occurrence-match.types";
import { urlKeyLinksWithOccurrenceLookup } from "@/candidates/occurrence-url-link.utils";

const ACTIVE_PRIMARY_STATUSES = new Set([
  "awaiting_enrichment",
  "pending_review",
  "needs_changes",
  "approved"
]);

export interface OccurrencePersistFields {
  occurrenceId: string;
  occurrenceKey: string | null;
  urlKey: string | null;
  canonicalCandidateId: string | null;
  matchedEventId: string | null;
  statusOverride: string | null;
  matchStep: OccurrenceMatchStep;
  primaryCandidateId: string | null;
  publishedEventId: string | null;
}

export interface ResolveOccurrenceInput {
  event: NormalizedEvent;
  existingId?: string;
  existingOccurrenceId?: string | null;
  existingStatus?: string;
  existingMatchedEventId?: string | null;
  existingCanonicalCandidateId?: string | null;
  baseStatus: string;
  crossSourceDedupe: boolean;
  matchIndex: OccurrenceMatchIndex;
}

function candidateKey(source: string, sourceEventId: string) {
  return `${source}:${sourceEventId}`;
}

function rankPrimary(a: OccurrenceMatchCandidate, b: OccurrenceMatchCandidate): number {
  if (a.matched_event_id && !b.matched_event_id) {
    return -1;
  }
  if (!a.matched_event_id && b.matched_event_id) {
    return 1;
  }
  if (a.status === "approved" && b.status !== "approved") {
    return -1;
  }
  if (a.status !== "approved" && b.status === "approved") {
    return 1;
  }
  const sourceRank = sourcePriorityRank(a.source) - sourcePriorityRank(b.source);
  if (sourceRank !== 0) {
    return sourceRank;
  }
  return a.created_at.localeCompare(b.created_at);
}

export function pickPrimaryCandidate(candidates: OccurrenceMatchCandidate[]): OccurrenceMatchCandidate | null {
  const pool = candidates.filter(
    (row) => row.canonical_candidate_id === null && ACTIVE_PRIMARY_STATUSES.has(row.status)
  );
  if (pool.length === 0) {
    return candidates[0] ?? null;
  }
  return [...pool].sort(rankPrimary)[0] ?? null;
}

function findScheduledEvent(
  index: OccurrenceMatchIndex,
  occurrenceId: string | null,
  occurrenceKey: string | null
): OccurrenceMatchEvent | null {
  if (occurrenceId) {
    const byId = index.eventsByOccurrenceId.get(occurrenceId) ?? [];
    const scheduled = byId.find((row) => row.status === "scheduled");
    if (scheduled) {
      return scheduled;
    }
  }

  if (occurrenceKey) {
    const byKey = index.eventsByOccurrenceKey.get(occurrenceKey) ?? [];
    const scheduled = byKey.find((row) => row.status === "scheduled");
    if (scheduled) {
      return scheduled;
    }
  }

  return null;
}

function collectCandidatesForMatch(
  index: OccurrenceMatchIndex,
  fingerprints: Awaited<ReturnType<typeof computeOccurrenceFingerprints>>,
  urlKey: string | null
): { group: OccurrenceMatchCandidate[]; step: OccurrenceMatchStep } {
  const seen = new Map<string, OccurrenceMatchCandidate>();

  for (const key of fingerprints.occurrenceKeysForLookup) {
    for (const row of index.candidatesByOccurrenceKey.get(key) ?? []) {
      seen.set(row.id, row);
    }
  }

  if (seen.size > 0) {
    return { group: [...seen.values()], step: "occurrence_key" };
  }

  if (urlKey) {
    for (const row of index.candidatesByUrlKey.get(urlKey) ?? []) {
      if (urlKeyLinksWithOccurrenceLookup(fingerprints, row.occurrence_key)) {
        seen.set(row.id, row);
      }
    }
  }

  if (seen.size > 0) {
    return { group: [...seen.values()], step: "url_key" };
  }

  return { group: [], step: "new" };
}

export async function resolveOccurrenceForPersist(
  input: ResolveOccurrenceInput
): Promise<OccurrencePersistFields> {
  const fingerprints = await computeOccurrenceFingerprints(input.event);
  const occurrenceKey = fingerprints.occurrenceKey || null;
  const urlKey = fingerprints.urlKey;

  const selfKey = candidateKey(input.event.source, input.event.sourceEventId);

  if (input.existingOccurrenceId) {
    const siblings = input.matchIndex.candidatesByOccurrenceId.get(input.existingOccurrenceId) ?? [];
    const group = siblings.length > 0 ? siblings : [];
    const primary = pickPrimaryCandidate(group) ?? group[0] ?? null;
    const published = findScheduledEvent(input.matchIndex, input.existingOccurrenceId, occurrenceKey);
    const isSelfReingest =
      Boolean(input.existingId) &&
      (primary?.id === input.existingId || !group.some((row) => row.id !== input.existingId));

    return finalizeOccurrenceFields({
      ...input,
      occurrenceId: input.existingOccurrenceId,
      occurrenceKey,
      urlKey,
      matchStep: "new",
      group,
      primary: isSelfReingest ? (primary && primary.id === input.existingId ? primary : null) : primary,
      published,
      forceSelfPrimary: isSelfReingest
    });
  }

  const { group, step } = collectCandidatesForMatch(input.matchIndex, fingerprints, urlKey);
  const externalGroup = group.filter(
    (row) => candidateKey(row.source, row.source_event_id) !== selfKey
  );

  if (externalGroup.length === 0) {
    const occurrenceId = crypto.randomUUID();
    return {
      occurrenceId,
      occurrenceKey,
      urlKey,
      canonicalCandidateId: null,
      matchedEventId: input.existingMatchedEventId ?? null,
      statusOverride: null,
      matchStep: "new",
      primaryCandidateId: null,
      publishedEventId: null
    };
  }

  const primary = pickPrimaryCandidate(externalGroup) ?? externalGroup[0]!;
  const occurrenceId = primary.occurrence_id;
  const published = findScheduledEvent(input.matchIndex, occurrenceId, occurrenceKey);

  return finalizeOccurrenceFields({
    ...input,
    occurrenceId,
    occurrenceKey,
    urlKey,
    matchStep: step,
    group: externalGroup,
    primary,
    published
  });
}

function finalizeOccurrenceFields(
  input: ResolveOccurrenceInput & {
    occurrenceId: string;
    occurrenceKey: string | null;
    urlKey: string | null;
    matchStep: OccurrenceMatchStep;
    group: OccurrenceMatchCandidate[];
    primary: OccurrenceMatchCandidate | null;
    published: OccurrenceMatchEvent | null;
    forceSelfPrimary?: boolean;
  }
): OccurrencePersistFields {
  const publishedEventId = input.published?.id ?? input.primary?.matched_event_id ?? null;
  const primaryCandidateId = input.primary?.id ?? null;
  const isSelfPrimary =
    input.forceSelfPrimary === true ||
    (input.primary !== null &&
      input.primary.source === input.event.source &&
      input.primary.source_event_id === input.event.sourceEventId);

  let canonicalCandidateId: string | null = null;
  let statusOverride: string | null = null;
  let matchedEventId = input.existingMatchedEventId ?? publishedEventId ?? null;

  if (input.crossSourceDedupe) {
    if (publishedEventId) {
      matchedEventId = publishedEventId;
      if (!isSelfPrimary && input.primary) {
        canonicalCandidateId = input.primary.id;
        statusOverride = "duplicate";
      }
    } else if (input.primary && !isSelfPrimary) {
      canonicalCandidateId = input.primary.id;
      statusOverride = "duplicate";
      matchedEventId = input.primary.matched_event_id ?? matchedEventId;
    }
  } else if (input.primary && !isSelfPrimary) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_would_link",
        occurrence_id: input.occurrenceId,
        primary_candidate_id: input.primary.id,
        source: input.event.source,
        source_event_id: input.event.sourceEventId,
        match_step: input.matchStep
      })
    );
  }

  if (input.crossSourceDedupe && (publishedEventId || canonicalCandidateId)) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_linked",
        occurrence_id: input.occurrenceId,
        primary_candidate_id: primaryCandidateId,
        source: input.event.source,
        source_event_id: input.event.sourceEventId,
        match_step: input.matchStep,
        published_event_id: publishedEventId
      })
    );
  }

  return {
    occurrenceId: input.occurrenceId,
    occurrenceKey: input.occurrenceKey,
    urlKey: input.urlKey,
    canonicalCandidateId,
    matchedEventId,
    statusOverride,
    matchStep: input.matchStep,
    primaryCandidateId,
    publishedEventId
  };
}
