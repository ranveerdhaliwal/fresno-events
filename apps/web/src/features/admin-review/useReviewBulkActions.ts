import { useMutation } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import type { EventCandidate } from "@fresno-events/shared";

import {
  AdminApiError,
  bulkApproveAllPending,
  bulkApproveCandidates,
  bulkApproveChanges,
  bulkApproveChangesAll,
  bulkRejectCandidates,
  bulkSetCandidatePriority,
  bulkSetPublishedEventPriority,
  deleteCandidates,
  type BulkApproveBody,
  type ReviewQueueTab
} from "../admin/admin-api";
import {
  buildBulkApprovePriorityById,
  clearPriorityOverridesForIds
} from "../admin/admin-priority.utils";
import { togglePageSelection } from "./admin-review-selection.utils";

type UseReviewBulkActionsOptions = {
  token: string;
  activeTab: ReviewQueueTab;
  items: EventCandidate[];
  priorityOverrides: Record<string, number>;
  setPriorityOverrides: Dispatch<SetStateAction<Record<string, number>>>;
  onAfterDecision: (candidateId?: string) => void;
};

function formatBulkApproveMessage(result: {
  approved: number;
  skipped: Array<{ reason: string }>;
  failed: Array<{ id: string; message: string }>;
}) {
  const parts = [`Approved ${result.approved}.`];
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} skipped.`);
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed — refresh and retry.`);
    for (const item of result.failed.slice(0, 3)) {
      const detail = item.message.length > 120 ? `${item.message.slice(0, 120)}…` : item.message;
      parts.push(`${item.id}: ${detail}`);
    }
    if (result.failed.length > 3) {
      parts.push(`(+${result.failed.length - 3} more — see API logs: bulk_approve_item_failed)`);
    }
  }
  return parts.join(" ");
}

function formatBulkApproveChangesMessage(result: {
  approved: number;
  skipped: Array<{ reason: string }>;
  failed: Array<{ id: string; message: string }>;
}) {
  const parts = [`Approved ${result.approved} update(s).`];
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} skipped.`);
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed.`);
  }
  return parts.join(" ");
}

/**
 * Selection state plus the bulk decision mutations (approve / reject / delete /
 * priority) for the review queue. Selection and messages reset on tab change.
 */
export function useReviewBulkActions({
  token,
  activeTab,
  items,
  priorityOverrides,
  setPriorityOverrides,
  onAfterDecision
}: UseReviewBulkActionsOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPriority, setBulkPriority] = useState("");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkPriority("");
    setDeleteMessage(null);
    setApproveMessage(null);
  }, [activeTab]);

  const handleSelectAllPage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => togglePageSelection(prev, pageIds));
  }, []);

  const handleToggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkPriority("");
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (opts: { ids: string[]; force: boolean }) =>
      deleteCandidates(token, opts.ids, { force: opts.force }),
    onSuccess: (result) => {
      const parts = [`Deleted ${result.deleted}.`];
      if (result.skipped.length > 0) {
        const approved = result.skipped.filter((s) => s.reason === "approved").length;
        if (approved > 0) {
          parts.push(`${approved} skipped (approved).`);
        }
        const missing = result.skipped.filter((s) => s.reason === "not_found").length;
        if (missing > 0) {
          parts.push(`${missing} not found.`);
        }
      }
      setDeleteMessage(parts.join(" "));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setDeleteMessage(error instanceof AdminApiError ? error.message : "Delete failed.");
    }
  });

  const approveSelectedMutation = useMutation({
    mutationFn: (ids: string[]) => {
      const body: Omit<BulkApproveBody, "ids"> = { reviewedBy: "admin-bulk-ui" };
      const priorityById = buildBulkApprovePriorityById(ids, priorityOverrides);
      if (priorityById) {
        body.priorityById = priorityById;
      }
      return bulkApproveCandidates(token, ids, body);
    },
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveMessage(result));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk approve failed.");
    }
  });

  const approveAllMutation = useMutation({
    mutationFn: () => {
      const priorityById = buildBulkApprovePriorityById(
        items.map((candidate) => candidate.id),
        priorityOverrides
      );
      return bulkApproveAllPending(token, {
        reviewedBy: "admin-bulk-ui",
        ...(priorityById ? { priorityById } : {})
      });
    },
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveMessage(result));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Approve all failed.");
    }
  });

  const approveAllUpdatesMutation = useMutation({
    mutationFn: () => bulkApproveChangesAll(token, { reviewedBy: "admin-bulk-ui" }),
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveChangesMessage(result));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Approve all updates failed.");
    }
  });

  const approveSelectedUpdatesMutation = useMutation({
    mutationFn: (ids: string[]) => bulkApproveChanges(token, ids, { reviewedBy: "admin-bulk-ui" }),
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveChangesMessage(result));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk approve updates failed.");
    }
  });

  const bulkPriorityMutation = useMutation({
    mutationFn: async ({ ids, priority }: { ids: string[]; priority: number }) => {
      if (activeTab === "approved") {
        const eventIds = [
          ...new Set(
            ids
              .map((id) => items.find((candidate) => candidate.id === id)?.matchedEventId)
              .filter((eventId): eventId is string => typeof eventId === "string" && eventId.length > 0)
          )
        ];
        const [candidateResult, eventResult] = await Promise.all([
          bulkSetCandidatePriority(token, ids, priority),
          eventIds.length > 0
            ? bulkSetPublishedEventPriority(token, eventIds, priority)
            : Promise.resolve({ priority, updated: 0, failed: [] })
        ]);
        return { ...candidateResult, eventUpdated: eventResult.updated };
      }
      return bulkSetCandidatePriority(token, ids, priority);
    },
    onSuccess: (result, variables) => {
      setPriorityOverrides((prev) => clearPriorityOverridesForIds(prev, variables.ids));
      setSelectedIds(new Set());
      const failedPart =
        result.failed.length > 0 ? ` ${result.failed.length} failed.` : "";
      const eventPart =
        "eventUpdated" in result && result.eventUpdated > 0
          ? ` Updated ${result.eventUpdated} published event(s).`
          : "";
      setApproveMessage(`Set priority P${result.priority} on ${result.updated} row(s).${eventPart}${failedPart}`);
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk priority update failed.");
    }
  });

  const rejectSelectedMutation = useMutation({
    mutationFn: (ids: string[]) => bulkRejectCandidates(token, ids, { reviewedBy: "admin-bulk-ui" }),
    onSuccess: (result) => {
      const parts = [`Rejected ${result.rejected}.`];
      if (result.failed.length > 0) {
        parts.push(`${result.failed.length} failed.`);
      }
      setApproveMessage(parts.join(" "));
      setSelectedIds(new Set());
      onAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk reject failed.");
    }
  });

  const isPending =
    deleteMutation.isPending ||
    rejectSelectedMutation.isPending ||
    approveSelectedMutation.isPending ||
    approveAllMutation.isPending ||
    approveSelectedUpdatesMutation.isPending ||
    approveAllUpdatesMutation.isPending ||
    bulkPriorityMutation.isPending;

  return {
    selectedIds,
    bulkPriority,
    setBulkPriority,
    deleteMessage,
    approveMessage,
    handleSelectAllPage,
    handleToggleSelected,
    clearSelection,
    deleteMutation,
    approveSelectedMutation,
    approveAllMutation,
    approveAllUpdatesMutation,
    approveSelectedUpdatesMutation,
    bulkPriorityMutation,
    rejectSelectedMutation,
    isPending
  };
}
