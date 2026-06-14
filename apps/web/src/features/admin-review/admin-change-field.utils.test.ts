// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentDiffSummary } from "@fresno-events/shared";

import { changedFormFieldsFromDiff } from "./admin-change-field.utils";

const diff: ContentDiffSummary = {
  changedFields: ["descriptionText", "externalUrl", "priceMin", "startTs"],
  entries: []
};

describe("changedFormFieldsFromDiff", () => {
  it("maps content diff fields to form field keys", () => {
    expect(changedFormFieldsFromDiff(diff)).toEqual(
      new Set(["descriptionText", "externalUrl", "priceMin", "start"])
    );
  });

  it("returns empty set when diff is missing", () => {
    expect(changedFormFieldsFromDiff(undefined)).toEqual(new Set());
  });
});
