export interface ReviewOccurrenceRelinkLinkExample {
  title: string;
  primarySource: string;
  linkedSources: string[];
  crossSource: boolean;
  wouldChange: boolean;
}

export interface ReviewOccurrenceRelinkSummary {
  candidates: number;
  relinkable: number;
  skippedRejected: number;
  groups: number;
  multiSourceGroups: number;
  changed: number;
  unchanged: number;
  applied: number;
  errors: number;
  linkedAsDuplicate: number;
  promotedFromDuplicate: number;
  demotedToDuplicate: number;
  occurrenceKeyChanged: number;
  occurrenceIdChanged: number;
  priorityInherited: number;
  linkGroups: number;
  linkGroupsChanged: number;
  linkExamples: ReviewOccurrenceRelinkLinkExample[];
}

export interface ReviewOccurrenceRelinkOpsResponse {
  dryRun: boolean;
  summary: ReviewOccurrenceRelinkSummary;
  message: string;
}

export interface ReviewVenueAddressBackfillSummary {
  scanned: number;
  candidateUpdates: number;
  venueUpdates: number;
  errors: number;
}

export interface ReviewVenueAddressBackfillOpsResponse {
  dryRun: boolean;
  summary: ReviewVenueAddressBackfillSummary;
  message: string;
}

export interface ReviewPriorityRerankRuleGroup {
  ruleLabel: string;
  toPriority: number;
  count: number;
  samples: string[];
}

export interface ReviewPriorityRerankSectionSummary {
  scanned: number;
  wouldChange: number;
  applied: number;
  errors: number;
}

export interface ReviewPriorityRerankSection {
  summary: ReviewPriorityRerankSectionSummary;
  byRule: ReviewPriorityRerankRuleGroup[];
}

export interface ReviewPriorityRerankOpsResponse {
  dryRun: boolean;
  candidates: ReviewPriorityRerankSection;
  events: ReviewPriorityRerankSection;
  message: string;
}

/** @deprecated Use ReviewPriorityRerankRuleGroup */
export type ReviewPriorityTriageRuleGroup = ReviewPriorityRerankRuleGroup;

/** @deprecated Use ReviewPriorityRerankSectionSummary */
export type ReviewPriorityTriageSummary = ReviewPriorityRerankSectionSummary;

/** @deprecated Use ReviewPriorityRerankOpsResponse */
export interface ReviewPriorityTriageOpsResponse {
  dryRun: boolean;
  summary: ReviewPriorityRerankSectionSummary;
  byRule: ReviewPriorityRerankRuleGroup[];
  message: string;
}

export interface ReviewPublishedOrphanDeletion {
  eventId: string;
  slug: string;
  title: string;
  keepEventId: string;
  keepSlug: string;
}

export interface ReviewPublishedOrphanSummary {
  scheduledScanned: number;
  duplicateGroups: number;
  wouldDelete: number;
  deleted: number;
  errors: number;
  deletions: ReviewPublishedOrphanDeletion[];
}

export interface ReviewPublishedOrphanOpsResponse {
  dryRun: boolean;
  summary: ReviewPublishedOrphanSummary;
  message: string;
}

export interface ReviewVenueGeocodeSummary {
  scanned: number;
  geocoded: number;
  skipped: number;
  errors: number;
  venueScanned: number;
  candidateScanned: number;
  candidateGeocoded: number;
  batchesRun?: number;
  remaining?: number;
  remainingVenues?: number;
  remainingCandidates?: number;
}

export interface ReviewVenueGeocodeOpsResponse {
  dryRun: boolean;
  summary: ReviewVenueGeocodeSummary;
  message: string;
}
