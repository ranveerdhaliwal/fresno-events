import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, LogOut, RefreshCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReviewQueueAuditResponse } from "@fresno-events/shared";
import { ORGANIC_CANDIDATE_DISPLAY_PRIORITY } from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { Text } from "@/components/Text";
import {
  AdminApiError,
  bulkApproveAllPending,
  bulkApproveCandidates,
  bulkApproveChanges,
  bulkApproveChangesAll,
  bulkSetCandidatePriority,
  bulkRejectCandidates,
  deleteCandidates,
  fetchPreApproveAudit,
  getCandidate,
  runOccurrenceRelinkOps,
  runPriorityTriageOps,
  runVenueAddressBackfillOps,
  runVenueGeocodeOps,
  isAdminAuthError,
  listCandidates,
  reviewTabToStatus
} from "../admin/admin-api";
import {
  buildSeriesDisplayPriorities,
  clearPriorityOverride,
  clearPriorityOverridesForIds,
  effectivePriority,
  groupCandidatesByPriority,
  readPriorityOverrides,
  sortCandidatesForReview,
  writePriorityOverrides
} from "../admin/admin-priority.utils";

import { DetailLoading, EmptyDetail, ErrorBanner } from "./AdminReviewDetail.shared";
import {
  PRIMARY_TABS,
  SECONDARY_TABS,
  TAB_COPY,
  type ReviewWorkspaceProps
} from "./AdminReviewWorkspace.types";
import styles from "./AdminReviewWorkspace.module.css";
import { AdminSearchInput } from "./AdminSearchInput";
import { CandidateChangeDetail } from "./CandidateChangeDetail";
import { CandidateDetail } from "./CandidateDetail";
import { CandidateList } from "./CandidateList";
import { filterCandidatesForSearch } from "./admin-review-search.utils";
import { togglePageSelection } from "./admin-review-selection.utils";
import {
  AdminMaintenancePanel,
  type MaintenanceOpKind,
  type MaintenanceOpResult
} from "./AdminMaintenancePanel";
import { ReviewQueueAuditPanel } from "./ReviewQueueAuditPanel";

export function ReviewWorkspace({
  token,
  activeTab,
  onActiveTabChange,
  selectedId,
  onSelect,
  onChangeToken,
  onAuthFailure
}: ReviewWorkspaceProps) {
  const statusFilter = reviewTabToStatus(activeTab);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, number>>(() =>
    readPriorityOverrides()
  );
  const [bulkPriority, setBulkPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditResult, setAuditResult] = useState<ReviewQueueAuditResponse | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [maintenanceOp, setMaintenanceOp] = useState<MaintenanceOpKind | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceOpResult | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const searchActive = searchQuery.trim().length >= 2;

  const candidatesQuery = useQuery({
    queryKey: ["admin", "candidates", activeTab, token],
    queryFn: () => listCandidates(token, statusFilter),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !isAdminAuthError(error) && failureCount < 1
  });

  useEffect(() => {
    if (isAdminAuthError(candidatesQuery.error)) {
      onAuthFailure();
    }
  }, [candidatesQuery.error, onAuthFailure]);

  const items = candidatesQuery.data?.items ?? [];

  const searchResults = useMemo(() => {
    if (!searchActive) {
      return [];
    }
    return filterCandidatesForSearch(items, searchQuery);
  }, [items, searchActive, searchQuery]);

  const sortedItems = useMemo(
    () => sortCandidatesForReview(items, priorityOverrides),
    [items, priorityOverrides]
  );
  const seriesDisplayPriorities = useMemo(
    () => buildSeriesDisplayPriorities(items, priorityOverrides),
    [items, priorityOverrides]
  );
  const priorityGroups = useMemo(
    () => groupCandidatesByPriority(sortedItems, priorityOverrides, seriesDisplayPriorities),
    [sortedItems, priorityOverrides, seriesDisplayPriorities]
  );
  const listGroups = useMemo(() => {
    if (!searchActive) {
      return priorityGroups;
    }
    if (searchResults.length === 0) {
      return [];
    }
    const searchSeriesPriorities = buildSeriesDisplayPriorities(searchResults, priorityOverrides);
    return groupCandidatesByPriority(
      sortCandidatesForReview(searchResults, priorityOverrides),
      priorityOverrides,
      searchSeriesPriorities
    );
  }, [priorityGroups, searchActive, searchResults, priorityOverrides]);

  const visibleListItems = useMemo(() => listGroups.flatMap((group) => group.items), [listGroups]);

  const listSeriesDisplayPriorities = useMemo(
    () =>
      searchActive
        ? buildSeriesDisplayPriorities(visibleListItems, priorityOverrides)
        : seriesDisplayPriorities,
    [searchActive, visibleListItems, priorityOverrides, seriesDisplayPriorities]
  );

  const handleSelectAllPage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => togglePageSelection(prev, pageIds));
  }, []);
  const listLoading = candidatesQuery.isLoading;
  const activeId = selectedId ?? sortedItems[0]?.id ?? null;

  useEffect(() => {
    if (selectedId && !sortedItems.some((item) => item.id === selectedId)) {
      onSelect(null);
    }
  }, [sortedItems, selectedId, onSelect]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkPriority("");
    setDeleteMessage(null);
    setApproveMessage(null);
  }, [activeTab]);

  const handleAfterDecision = (candidateId?: string) => {
    if (candidateId) {
      setPriorityOverrides((prev) => clearPriorityOverride(candidateId, prev));
    }
    queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "candidate"] });
  };

  const handleSeriesUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "candidate", activeId, token] });
  };

  const handlePriorityChange = (candidateId: string, priority: number) => {
    setPriorityOverrides((prev) => {
      const next = { ...prev, [candidateId]: priority };
      writePriorityOverrides(next);
      return next;
    });
  };

  const formatBulkApproveMessage = (result: {
    approved: number;
    skipped: Array<{ reason: string }>;
    failed: Array<{ id: string; message: string }>;
  }) => {
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
  };

  const formatBulkApproveChangesMessage = (result: {
    approved: number;
    skipped: Array<{ reason: string }>;
    failed: Array<{ id: string; message: string }>;
  }) => {
    const parts = [`Approved ${result.approved} update(s).`];
    if (result.skipped.length > 0) {
      parts.push(`${result.skipped.length} skipped.`);
    }
    if (result.failed.length > 0) {
      parts.push(`${result.failed.length} failed.`);
    }
    return parts.join(" ");
  };

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
      handleAfterDecision();
    },
    onError: (error: unknown) => {
      setDeleteMessage(error instanceof AdminApiError ? error.message : "Delete failed.");
    }
  });

  const approveSelectedMutation = useMutation({
    mutationFn: (ids: string[]) =>
      bulkApproveCandidates(token, ids, { reviewedBy: "admin-bulk-ui" }),
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveMessage(result));
      setSelectedIds(new Set());
      handleAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk approve failed.");
    }
  });

  const approveAllMutation = useMutation({
    mutationFn: () => bulkApproveAllPending(token, { reviewedBy: "admin-bulk-ui" }),
    onSuccess: (result) => {
      setApproveMessage(formatBulkApproveMessage(result));
      setSelectedIds(new Set());
      handleAfterDecision();
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
      handleAfterDecision();
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
      handleAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk approve updates failed.");
    }
  });

  const bulkPriorityMutation = useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: number }) =>
      bulkSetCandidatePriority(token, ids, priority),
    onSuccess: (result, variables) => {
      setPriorityOverrides((prev) => clearPriorityOverridesForIds(prev, variables.ids));
      setSelectedIds(new Set());
      const failedPart =
        result.failed.length > 0 ? ` ${result.failed.length} failed.` : "";
      setApproveMessage(`Set priority P${result.priority} on ${result.updated} row(s).${failedPart}`);
      handleAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk priority update failed.");
    }
  });

  const preApproveAuditMutation = useMutation({
    mutationFn: () => fetchPreApproveAudit(token),
    onSuccess: (result) => {
      setAuditResult(result);
      setAuditError(null);
    },
    onError: (error: unknown) => {
      setAuditResult(null);
      setAuditError(error instanceof AdminApiError ? error.message : "Pre-approve check failed.");
    }
  });

  const relinkOpsMutation = useMutation({
    mutationFn: (dryRun: boolean) => runOccurrenceRelinkOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("relink");
      setMaintenanceResult({ kind: "relink", dryRun });
    },
    onSuccess: (relink, dryRun) => {
      setMaintenanceResult({ kind: "relink", dryRun, relink });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "relink",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Occurrence relink failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const addressBackfillMutation = useMutation({
    mutationFn: (dryRun: boolean) => runVenueAddressBackfillOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("addresses");
      setMaintenanceResult({ kind: "addresses", dryRun });
    },
    onSuccess: (addresses, dryRun) => {
      setMaintenanceResult({ kind: "addresses", dryRun, addresses });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "addresses",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Venue address cleanup failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const priorityTriageMutation = useMutation({
    mutationFn: (dryRun: boolean) => runPriorityTriageOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("priority");
      setMaintenanceResult({ kind: "priority", dryRun });
    },
    onSuccess: (priority, dryRun) => {
      setMaintenanceResult({ kind: "priority", dryRun, priority });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "priority",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Priority triage failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
    }
  });

  const geocodeOpsMutation = useMutation({
    mutationFn: (dryRun: boolean) => runVenueGeocodeOps(token, dryRun),
    onMutate: (dryRun) => {
      setMaintenanceOp("geocode");
      setMaintenanceResult({ kind: "geocode", dryRun });
    },
    onSuccess: (geocode, dryRun) => {
      setMaintenanceResult({ kind: "geocode", dryRun, geocode });
    },
    onError: (error: unknown, dryRun) => {
      setMaintenanceResult({
        kind: "geocode",
        dryRun,
        error: error instanceof AdminApiError ? error.message : "Venue geocode failed."
      });
    },
    onSettled: () => {
      setMaintenanceOp(null);
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
      handleAfterDecision();
    },
    onError: (error: unknown) => {
      setApproveMessage(error instanceof AdminApiError ? error.message : "Bulk reject failed.");
    }
  });

  const bulkActionPending =
    deleteMutation.isPending ||
    rejectSelectedMutation.isPending ||
    approveSelectedMutation.isPending ||
    approveAllMutation.isPending ||
    approveSelectedUpdatesMutation.isPending ||
    approveAllUpdatesMutation.isPending ||
    bulkPriorityMutation.isPending ||
    preApproveAuditMutation.isPending ||
    relinkOpsMutation.isPending ||
    addressBackfillMutation.isPending ||
    priorityTriageMutation.isPending ||
    geocodeOpsMutation.isPending;

  const maintenanceLoading =
    relinkOpsMutation.isPending ||
    addressBackfillMutation.isPending ||
    priorityTriageMutation.isPending ||
    geocodeOpsMutation.isPending;

  const handleMaintenanceCheck = useCallback(
    (kind: MaintenanceOpKind) => {
      if (kind === "relink") {
        relinkOpsMutation.mutate(true);
        return;
      }
      if (kind === "addresses") {
        addressBackfillMutation.mutate(true);
        return;
      }
      if (kind === "geocode") {
        geocodeOpsMutation.mutate(true);
        return;
      }
      priorityTriageMutation.mutate(true);
    },
    [addressBackfillMutation, geocodeOpsMutation, priorityTriageMutation, relinkOpsMutation]
  );

  const handleMaintenanceApply = useCallback(
    (kind: MaintenanceOpKind) => {
      if (kind === "relink") {
        if (
          window.confirm(
            "Run occurrence relink? This updates occurrence keys and cross-source duplicate links."
          )
        ) {
          relinkOpsMutation.mutate(false);
        }
        return;
      }
      if (kind === "addresses") {
        if (
          window.confirm(
            "Fix venue addresses? This normalizes mailing-line addresses on candidates and published venues."
          )
        ) {
          addressBackfillMutation.mutate(false);
        }
        return;
      }
      if (kind === "geocode") {
        if (
          window.confirm(
            "Geocode venues missing coordinates? Apply is rate-limited (~50 venues max per run)."
          )
        ) {
          geocodeOpsMutation.mutate(false);
        }
        return;
      }
      if (
        window.confirm(
          "Apply priority triage? This patches suggested_priority on pending primaries when editorial rules match."
        )
      ) {
        priorityTriageMutation.mutate(false);
      }
    },
    [addressBackfillMutation, geocodeOpsMutation, priorityTriageMutation, relinkOpsMutation]
  );

  const candidateQuery = useQuery({
    queryKey: ["admin", "candidate", activeId, token],
    queryFn: () => (activeId ? getCandidate(token, activeId) : Promise.resolve(null)),
    enabled: Boolean(activeId)
  });

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <Text variant="eyebrow">Admin</Text>
          <Text variant="header1" className={styles.title}>
            {TAB_COPY[activeTab].title}
          </Text>
          <Text variant="body1" tone="mutedOnPage" className={styles.subtitle}>
            {TAB_COPY[activeTab].subtitle}
          </Text>
          <AdminSearchInput onDebouncedChange={handleSearchChange} />
          <div className={styles.tabRow}>
            {PRIMARY_TABS.map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={activeTab === tab.id ? "approve" : "secondary"}
                onClick={() => onActiveTabChange(tab.id)}
              >
                {tab.label}
                {tab.id === "new" && activeTab === "new" ? ` (${items.length})` : ""}
                {tab.id === "updates" && activeTab === "updates" ? ` (${items.length})` : ""}
              </Button>
            ))}
            <span className={styles.tabDivider} aria-hidden>
              |
            </span>
            {SECONDARY_TABS.map((tab) => (
              <Button
                key={tab.id}
                size="xs"
                variant={activeTab === tab.id ? "secondaryActive" : "secondary"}
                onClick={() => onActiveTabChange(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          {activeTab === "new" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkActionPending || candidatesQuery.isLoading}
              onClick={() => preApproveAuditMutation.mutate()}
            >
              {preApproveAuditMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ClipboardList className="size-3.5" aria-hidden />
              )}
              Pre-approve check
            </Button>
          ) : null}
          {activeTab === "new" ? (
            <Button
              variant="approve"
              size="sm"
              disabled={bulkActionPending || candidatesQuery.isLoading}
              onClick={() => approveAllMutation.mutate()}
            >
              {approveAllMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              Approve all pending
            </Button>
          ) : null}
          {activeTab === "updates" ? (
            <Button
              variant="approve"
              size="sm"
              disabled={bulkActionPending || candidatesQuery.isLoading}
              onClick={() => approveAllUpdatesMutation.mutate()}
            >
              {approveAllUpdatesMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              Approve all updates
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => candidatesQuery.refetch()}
          >
            <RefreshCcw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={onChangeToken}>
            <LogOut className="size-3.5" aria-hidden />
            Change token
          </Button>
        </div>
      </header>

      {candidatesQuery.isError ? (
        <ErrorBanner error={candidatesQuery.error} />
      ) : null}

      <AdminMaintenancePanel
        activeOp={maintenanceOp}
        isLoading={maintenanceLoading}
        result={maintenanceResult}
        onCheck={handleMaintenanceCheck}
        onApply={handleMaintenanceApply}
        onDismiss={() => setMaintenanceResult(null)}
      />

      {activeTab === "new" ? (
        <ReviewQueueAuditPanel
          audit={auditResult}
          isLoading={preApproveAuditMutation.isPending}
          error={auditError}
          onDismiss={() => {
            setAuditResult(null);
            setAuditError(null);
          }}
        />
      ) : null}

      {approveMessage ? (
        <Text variant="body1" tone="onCard" className={styles.message}>
          {approveMessage}
        </Text>
      ) : null}

      {deleteMessage ? (
        <Text variant="body1" tone="onCard" className={styles.message}>
          {deleteMessage}
        </Text>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className={styles.bulkBar}>
          <span className={styles.bulkBarLabel}>{selectedIds.size} selected</span>
          <label className={styles.bulkPriorityField}>
            <span className={styles.bulkPriorityLabel}>Priority</span>
            <SelectInput
              className={styles.bulkPrioritySelect}
              value={bulkPriority}
              onChange={(event) => setBulkPriority(event.target.value)}
              aria-label="Bulk display priority"
            >
              <option value="" disabled>
                Choose priority…
              </option>
              {ORGANIC_CANDIDATE_DISPLAY_PRIORITY.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  P{tier.value} — {tier.label}
                </option>
              ))}
            </SelectInput>
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkActionPending || bulkPriority === ""}
            onClick={() => {
              const priority = Number(bulkPriority);
              if (
                window.confirm(
                  `Set priority P${priority} on ${selectedIds.size} selected candidate(s)?`
                )
              ) {
                bulkPriorityMutation.mutate({ ids: [...selectedIds], priority });
              }
            }}
          >
            {bulkPriorityMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Set priority
          </Button>
          {activeTab === "new" ? (
            <Button
              variant="approve"
              size="sm"
              disabled={bulkActionPending}
              onClick={() => approveSelectedMutation.mutate([...selectedIds])}
            >
              {approveSelectedMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              Approve selected
            </Button>
          ) : null}
          {activeTab === "updates" ? (
            <Button
              variant="approve"
              size="sm"
              disabled={bulkActionPending}
              onClick={() => approveSelectedUpdatesMutation.mutate([...selectedIds])}
            >
              {approveSelectedUpdatesMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="size-3.5" aria-hidden />
              )}
              Approve selected updates
            </Button>
          ) : null}
          <Button
            variant="reject"
            size="sm"
            disabled={bulkActionPending}
            onClick={() => {
              if (
                window.confirm(
                  `Reject ${selectedIds.size} selected candidate(s)? They will move to the Rejected tab.`
                )
              ) {
                rejectSelectedMutation.mutate([...selectedIds]);
              }
            }}
          >
            {rejectSelectedMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            Reject selected
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkActionPending}
            onClick={() => {
              if (window.confirm(`Delete ${selectedIds.size} candidate(s)? This cannot be undone.`)) {
                deleteMutation.mutate({ ids: [...selectedIds], force: false });
              }
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete selected
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkActionPending}
            onClick={() => {
              if (
                window.confirm(
                  `Force-delete ${selectedIds.size} candidate(s), including any approved rows?`
                )
              ) {
                deleteMutation.mutate({ ids: [...selectedIds], force: true });
              }
            }}
          >
            Force delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedIds(new Set());
              setBulkPriority("");
            }}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.listCol}>
          <CandidateList
          groups={listGroups}
          activeId={activeId}
          isLoading={listLoading}
          onSelect={onSelect}
          statusFilter={statusFilter}
          selectedIds={selectedIds}
          priorityOverrides={priorityOverrides}
          seriesDisplayPriorities={listSeriesDisplayPriorities}
          searchMode={searchActive}
          searchQuery={searchQuery}
          onToggleSelected={(id) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            });
          }}
          onSelectAll={handleSelectAllPage}
          />
        </div>

        <div className={styles.detailCol}>
          <section className={styles.detailPane}>
          {!activeId ? (
            <EmptyDetail statusFilter={statusFilter} />
          ) : candidateQuery.isLoading ? (
            <DetailLoading />
          ) : candidateQuery.isError ? (
            <ErrorBanner error={candidateQuery.error} />
          ) : candidateQuery.data ? (
            activeTab === "updates" ? (
              <CandidateChangeDetail
                token={token}
                candidate={candidateQuery.data.candidate}
                {...(candidateQuery.data.contentDiff
                  ? { contentDiff: candidateQuery.data.contentDiff }
                  : {})}
                {...(candidateQuery.data.publishedEvent
                  ? { publishedEvent: candidateQuery.data.publishedEvent }
                  : {})}
                displayPriority={effectivePriority(candidateQuery.data.candidate, priorityOverrides)}
                onAfterDecision={handleAfterDecision}
              />
            ) : (
              <CandidateDetail
                token={token}
                candidate={candidateQuery.data.candidate}
                linkedCandidates={candidateQuery.data.linkedCandidates ?? []}
                seriesSiblings={candidateQuery.data.seriesSiblings ?? []}
                displayPriority={effectivePriority(candidateQuery.data.candidate, priorityOverrides)}
                onPriorityChange={handlePriorityChange}
                onAfterDecision={handleAfterDecision}
                onSeriesUpdated={handleSeriesUpdated}
                onSelectCandidate={onSelect}
              />
            )
          ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
