import type {
  ReviewOccurrenceRelinkLinkExample,
  ReviewOccurrenceRelinkOpsResponse,
  ReviewOccurrenceRelinkSummary,
  ReviewPriorityRerankRuleGroup
} from "@fresno-events/shared";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeLinkExample(
  example: Partial<ReviewOccurrenceRelinkLinkExample>
): ReviewOccurrenceRelinkLinkExample | null {
  const title = example.title?.trim();
  const primarySource = example.primarySource?.trim();
  if (!title || !primarySource) {
    return null;
  }

  const linkedSources = (example.linkedSources ?? [])
    .map((source) => source.trim())
    .filter(Boolean);
  if (linkedSources.length === 0) {
    return null;
  }

  return {
    title,
    primarySource,
    linkedSources,
    crossSource: example.crossSource === true,
    wouldChange: example.wouldChange === true
  };
}

export function normalizeOccurrenceRelinkSummary(
  summary: Partial<ReviewOccurrenceRelinkSummary> | undefined
): ReviewOccurrenceRelinkSummary {
  const raw = summary ?? {};
  return {
    candidates: num(raw.candidates),
    relinkable: num(raw.relinkable),
    skippedRejected: num(raw.skippedRejected),
    groups: num(raw.groups),
    multiSourceGroups: num(raw.multiSourceGroups),
    changed: num(raw.changed),
    unchanged: num(raw.unchanged),
    applied: num(raw.applied),
    errors: num(raw.errors),
    linkedAsDuplicate: num(raw.linkedAsDuplicate),
    promotedFromDuplicate: num(raw.promotedFromDuplicate),
    demotedToDuplicate: num(raw.demotedToDuplicate),
    occurrenceKeyChanged: num(raw.occurrenceKeyChanged),
    occurrenceIdChanged: num(raw.occurrenceIdChanged),
    priorityInherited: num(raw.priorityInherited),
    linkGroups: num(raw.linkGroups),
    linkGroupsChanged: num(raw.linkGroupsChanged),
    linkExamples: (raw.linkExamples ?? [])
      .map((example) => normalizeLinkExample(example))
      .filter((example): example is ReviewOccurrenceRelinkLinkExample => example !== null)
  };
}

export function normalizeOccurrenceRelinkOpsResponse(
  response: ReviewOccurrenceRelinkOpsResponse
): ReviewOccurrenceRelinkOpsResponse {
  return {
    ...response,
    summary: normalizeOccurrenceRelinkSummary(response.summary)
  };
}

export function normalizePriorityRuleGroups(
  groups: ReviewPriorityRerankRuleGroup[] | undefined
): ReviewPriorityRerankRuleGroup[] {
  return (groups ?? []).map((group) => ({
    ruleLabel: group.ruleLabel ?? "Rule",
    toPriority: num(group.toPriority),
    count: num(group.count),
    samples: group.samples ?? []
  }));
}
