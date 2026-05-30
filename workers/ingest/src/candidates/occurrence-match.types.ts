export type OccurrenceMatchStep = "occurrence_key" | "url_key" | "new";

export interface OccurrenceMatchCandidate {
  id: string;
  source: string;
  source_event_id: string;
  status: string;
  matched_event_id: string | null;
  occurrence_id: string;
  canonical_candidate_id: string | null;
  created_at: string;
  occurrence_key: string | null;
  url_key: string | null;
}

export interface OccurrenceMatchEvent {
  id: string;
  occurrence_id: string | null;
  occurrence_key: string | null;
  status: string;
}

export interface OccurrenceMatchIndex {
  candidatesByOccurrenceKey: Map<string, OccurrenceMatchCandidate[]>;
  candidatesByUrlKey: Map<string, OccurrenceMatchCandidate[]>;
  candidatesByOccurrenceId: Map<string, OccurrenceMatchCandidate[]>;
  eventsByOccurrenceKey: Map<string, OccurrenceMatchEvent[]>;
  eventsByOccurrenceId: Map<string, OccurrenceMatchEvent[]>;
}
