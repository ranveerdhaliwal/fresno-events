import type { ContentDiffField, ContentDiffSummary } from "@fresno-events/shared";

/** Form sections in the Updates review panel that can be highlighted when they differ from published. */
export type ChangeFormFieldKey =
  | "title"
  | "category"
  | "start"
  | "end"
  | "venueName"
  | "venueCity"
  | "venueAddress"
  | "venueLocation"
  | "externalUrl"
  | "ticketUrl"
  | "priceMin"
  | "priceMax"
  | "descriptionText";

const DIFF_TO_FORM_FIELD: Record<ContentDiffField, ChangeFormFieldKey | ChangeFormFieldKey[]> = {
  title: "title",
  category: "category",
  startTs: "start",
  endTs: "end",
  venueName: "venueName",
  venueCity: "venueCity",
  venueAddress: "venueAddress",
  descriptionText: "descriptionText",
  ticketUrl: "ticketUrl",
  externalUrl: "externalUrl",
  priceMin: "priceMin",
  priceMax: "priceMax"
};

export function changedFormFieldsFromDiff(contentDiff?: ContentDiffSummary): Set<ChangeFormFieldKey> {
  const changed = new Set<ChangeFormFieldKey>();
  if (!contentDiff) {
    return changed;
  }

  for (const field of contentDiff.changedFields) {
    const mapped = DIFF_TO_FORM_FIELD[field];
    if (Array.isArray(mapped)) {
      for (const key of mapped) {
        changed.add(key);
      }
    } else {
      changed.add(mapped);
    }
  }

  return changed;
}
