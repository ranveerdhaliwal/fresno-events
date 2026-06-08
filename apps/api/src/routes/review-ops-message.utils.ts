import type {
  ReviewOccurrenceRelinkOpsResponse,
  ReviewOccurrenceRelinkSummary,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueAddressBackfillSummary
} from "@fresno-events/shared";

interface IngestRelinkSummary {
  dry_run?: boolean;
  candidates?: number;
  relinkable?: number;
  skipped_rejected?: number;
  groups?: number;
  multi_source_groups?: number;
  changed?: number;
  unchanged?: number;
  applied?: number;
  errors?: number;
  linked_as_duplicate?: number;
  promoted_from_duplicate?: number;
  demoted_to_duplicate?: number;
  occurrence_key_changed?: number;
  occurrence_id_changed?: number;
  priority_inherited?: number;
}

interface IngestAddressBackfillSummary {
  dry_run?: boolean;
  scanned?: number;
  candidate_updates?: number;
  venue_updates?: number;
  errors?: number;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapOccurrenceRelinkSummary(raw: IngestRelinkSummary): ReviewOccurrenceRelinkSummary {
  return {
    candidates: num(raw.candidates),
    relinkable: num(raw.relinkable),
    skippedRejected: num(raw.skipped_rejected),
    groups: num(raw.groups),
    multiSourceGroups: num(raw.multi_source_groups),
    changed: num(raw.changed),
    unchanged: num(raw.unchanged),
    applied: num(raw.applied),
    errors: num(raw.errors),
    linkedAsDuplicate: num(raw.linked_as_duplicate),
    promotedFromDuplicate: num(raw.promoted_from_duplicate),
    demotedToDuplicate: num(raw.demoted_to_duplicate),
    occurrenceKeyChanged: num(raw.occurrence_key_changed),
    occurrenceIdChanged: num(raw.occurrence_id_changed),
    priorityInherited: num(raw.priority_inherited)
  };
}

export function buildOccurrenceRelinkMessage(
  dryRun: boolean,
  summary: ReviewOccurrenceRelinkSummary
): string {
  const mode = dryRun ? "Check only — no database writes" : "Applied";
  const lines = [
    `Occurrence relink (${mode})`,
    `${summary.candidates} candidates (${summary.relinkable} relinkable)`,
    `${summary.groups} show nights (${summary.multiSourceGroups} cross-source)`,
    dryRun
      ? `${summary.changed} row(s) would update · ${summary.unchanged} already correct`
      : `${summary.changed} row(s) updated · ${summary.applied} patches applied · ${summary.errors} error(s)`,
    `Duplicate links: ${summary.linkedAsDuplicate} linked · ${summary.promotedFromDuplicate} promoted · ${summary.demotedToDuplicate} demoted`
  ];
  if (summary.occurrenceKeyChanged > 0 || summary.occurrenceIdChanged > 0) {
    lines.push(
      `Key migrations: ${summary.occurrenceKeyChanged} occurrence_key · ${summary.occurrenceIdChanged} occurrence_id`
    );
  }
  if (dryRun && summary.changed === 0) {
    lines.push("Nothing to fix — all candidates match current matching rules.");
  } else if (dryRun) {
    lines.push("Run without check mode to apply these updates.");
  }
  return lines.join("\n");
}

export function buildOccurrenceRelinkOpsResponse(
  dryRun: boolean,
  raw: IngestRelinkSummary
): ReviewOccurrenceRelinkOpsResponse {
  const summary = mapOccurrenceRelinkSummary(raw);
  return {
    dryRun,
    summary,
    message: buildOccurrenceRelinkMessage(dryRun, summary)
  };
}

export function mapVenueAddressBackfillSummary(
  raw: IngestAddressBackfillSummary
): ReviewVenueAddressBackfillSummary {
  return {
    scanned: num(raw.scanned),
    candidateUpdates: num(raw.candidate_updates),
    venueUpdates: num(raw.venue_updates),
    errors: num(raw.errors)
  };
}

export function buildVenueAddressBackfillMessage(
  dryRun: boolean,
  summary: ReviewVenueAddressBackfillSummary
): string {
  const mode = dryRun ? "Check only — no database writes" : "Applied";
  const lines = [
    `Venue address cleanup (${mode})`,
    `Scanned ${summary.scanned} candidates`,
    `${summary.candidateUpdates} candidate address(es) ${dryRun ? "to fix" : "fixed"}`,
    `${summary.venueUpdates} published venue row(s) ${dryRun ? "to fix" : "fixed"}`
  ];
  if (!dryRun) {
    lines.push(`${summary.errors} error(s)`);
  }
  if (dryRun && summary.candidateUpdates === 0 && summary.venueUpdates === 0) {
    lines.push("No mailing-line addresses found — nothing to fix.");
  } else if (dryRun) {
    lines.push("Run fix to apply these updates.");
  }
  return lines.join("\n");
}

export function buildVenueAddressBackfillOpsResponse(
  dryRun: boolean,
  raw: IngestAddressBackfillSummary
): ReviewVenueAddressBackfillOpsResponse {
  const summary = mapVenueAddressBackfillSummary(raw);
  return {
    dryRun,
    summary,
    message: buildVenueAddressBackfillMessage(dryRun, summary)
  };
}
