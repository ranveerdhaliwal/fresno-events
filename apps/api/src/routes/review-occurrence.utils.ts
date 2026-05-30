import type { EventCandidate, LinkedEventCandidate } from "@fresno-events/shared";

export interface SourceRefAlternate {
  source: string;
  source_event_id: string;
  candidate_id?: string;
  source_url?: string;
}

export function buildAlternatesFromCandidates(
  primary: EventCandidate,
  siblings: EventCandidate[]
): SourceRefAlternate[] {
  const alternates: SourceRefAlternate[] = [];

  for (const row of siblings) {
    if (row.id === primary.id) {
      continue;
    }

    alternates.push({
      source: row.source,
      source_event_id: row.sourceEventId,
      candidate_id: row.id,
      ...(row.sourceUrl ? { source_url: row.sourceUrl } : {})
    });
  }

  return alternates;
}

export function mergeSourceRefsWithAlternates(
  base: Record<string, string>,
  alternates: SourceRefAlternate[]
): Record<string, unknown> {
  const existingRaw = base.alternates;
  let existing: SourceRefAlternate[] = [];

  if (typeof existingRaw === "string") {
    try {
      const parsed = JSON.parse(existingRaw) as unknown;
      if (Array.isArray(parsed)) {
        existing = parsed as SourceRefAlternate[];
      }
    } catch {
      existing = [];
    }
  }

  const seen = new Set(existing.map((row) => `${row.source}:${row.source_event_id}`));

  for (const row of alternates) {
    const key = `${row.source}:${row.source_event_id}`;
    if (!seen.has(key)) {
      existing.push(row);
      seen.add(key);
    }
  }

  return {
    ...base,
    alternates: existing
  };
}

export function toLinkedCandidate(candidate: EventCandidate): LinkedEventCandidate {
  return {
    id: candidate.id,
    source: candidate.source,
    sourceEventId: candidate.sourceEventId,
    title: candidate.title,
    status: candidate.status,
    ...(candidate.sourceUrl ? { sourceUrl: candidate.sourceUrl } : {}),
    ...(candidate.ticketUrl ? { ticketUrl: candidate.ticketUrl } : {})
  };
}
