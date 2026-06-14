import type {
  ReviewOccurrenceRelinkLinkExample,
  ReviewOccurrenceRelinkOpsResponse,
  ReviewOccurrenceRelinkSummary,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueAddressBackfillSummary
} from "@fresno-events/shared";

interface IngestRelinkLinkExample {
  title?: string;
  primary_source?: string;
  linked_sources?: string[];
  cross_source?: boolean;
  would_change?: boolean;
}

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
  link_groups?: number;
  link_groups_changed?: number;
  link_examples?: IngestRelinkLinkExample[];
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

function mapLinkExample(raw: IngestRelinkLinkExample): ReviewOccurrenceRelinkLinkExample | null {
  const title = raw.title?.trim();
  const primarySource = raw.primary_source?.trim();
  if (!title || !primarySource) {
    return null;
  }

  const linkedSources = (raw.linked_sources ?? []).map((source) => source.trim()).filter(Boolean);
  if (linkedSources.length === 0) {
    return null;
  }

  return {
    title,
    primarySource,
    linkedSources,
    crossSource: raw.cross_source === true,
    wouldChange: raw.would_change === true
  };
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
    priorityInherited: num(raw.priority_inherited),
    linkGroups: num(raw.link_groups),
    linkGroupsChanged: num(raw.link_groups_changed),
    linkExamples: (raw.link_examples ?? [])
      .map(mapLinkExample)
      .filter((example): example is ReviewOccurrenceRelinkLinkExample => example !== null)
  };
}

function formatLinkExample(example: ReviewOccurrenceRelinkLinkExample): string {
  const linked = example.linkedSources.join(", ");
  const tag = example.crossSource ? "cross-source" : "same source";
  return `${example.title} — ${example.primarySource} + ${linked} (${tag})`;
}

export function buildOccurrenceRelinkMessage(
  dryRun: boolean,
  summary: ReviewOccurrenceRelinkSummary
): string {
  if (dryRun) {
    if (summary.changed === 0) {
      return "Nothing to fix — duplicate links already match current rules.";
    }

    const crossSourceNote =
      summary.linkGroupsChanged > 0 && summary.multiSourceGroups > 0
        ? `, including ${summary.multiSourceGroups} cross-source`
        : "";
    const lines = [
      `Would update ${summary.changed} row(s) across ${summary.linkGroupsChanged} link group(s)${crossSourceNote}.`
    ];

    const linkExamples = summary.linkExamples ?? [];
    if (linkExamples.length > 0) {
      lines.push("", "Examples:");
      for (const example of linkExamples) {
        lines.push(`• ${formatLinkExample(example)}`);
      }
      const shownChanged = linkExamples.filter((example) => example.wouldChange).length;
      const remaining = summary.linkGroupsChanged - shownChanged;
      if (remaining > 0) {
        lines.push(`• …and ${remaining} more link group(s)`);
      }
    }

    lines.push("", "Click Run to apply.");
    return lines.join("\n");
  }

  const lines = [
    `Updated ${summary.applied} row(s) across ${summary.linkGroupsChanged || summary.linkGroups} link group(s).`
  ];
  if (summary.errors > 0) {
    lines.push(`${summary.errors} error(s).`);
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
