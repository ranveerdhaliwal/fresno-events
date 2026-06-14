import type { EventCandidateTabCounts } from "@fresno-events/shared";

import type { ReviewQueueTab } from "../admin/admin-api";
import { reviewTabToStatus } from "../admin/admin-api";

export function tabCountForReviewTab(
  tab: ReviewQueueTab,
  counts: EventCandidateTabCounts | undefined
): number | undefined {
  if (!counts) {
    return undefined;
  }
  return counts[reviewTabToStatus(tab)];
}

export function formatReviewTabLabel(tabLabel: string, count: number | undefined): string {
  return typeof count === "number" ? `${tabLabel} (${count})` : tabLabel;
}
