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

export interface ReviewPriorityTriageRuleGroup {
  ruleLabel: string;
  toPriority: number;
  count: number;
  samples: string[];
}

export interface ReviewPriorityTriageSummary {
  scanned: number;
  wouldChange: number;
  applied: number;
  errors: number;
}

export interface ReviewPriorityTriageOpsResponse {
  dryRun: boolean;
  summary: ReviewPriorityTriageSummary;
  byRule: ReviewPriorityTriageRuleGroup[];
  message: string;
}

export interface ReviewVenueGeocodeSummary {
  scanned: number;
  geocoded: number;
  skipped: number;
  errors: number;
}

export interface ReviewVenueGeocodeOpsResponse {
  dryRun: boolean;
  summary: ReviewVenueGeocodeSummary;
  message: string;
}
