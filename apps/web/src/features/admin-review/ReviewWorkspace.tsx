import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, LogOut, RefreshCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LinkedEventCandidate } from "@fresno-events/shared";
import { ORGANIC_CANDIDATE_DISPLAY_PRIORITY } from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { Text } from "@/components/Text";
import {
  fetchCandidateTabCounts,
  getCandidate,
  isAdminAuthError,
  listCandidates,
  reviewTabToStatus
} from "../admin/admin-api";
import {
  clearPriorityOverride,
  readPriorityOverrides,
  resolveDetailDisplayPriority,
  writePriorityOverrides
} from "../admin/admin-priority.utils";
import {
  candidateStatusToReviewTab,
  selectNextAfterDecision
} from "./admin-review-navigation.utils";

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
import { formatReviewTabLabel, tabCountForReviewTab } from "./admin-review-tab-counts.utils";
import { AdminMaintenancePanel } from "./AdminMaintenancePanel";
import { ReviewQueueAuditPanel } from "./ReviewQueueAuditPanel";
import { useReviewBulkActions } from "./useReviewBulkActions";
import { useReviewListGroups } from "./useReviewListGroups";
import { useReviewMaintenanceOps } from "./useReviewMaintenanceOps";

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
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, number>>(() =>
    readPriorityOverrides()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const candidatesQuery = useQuery({
    queryKey: ["admin", "candidates", activeTab, token],
    queryFn: () => listCandidates(token, statusFilter),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !isAdminAuthError(error) && failureCount < 1
  });

  const tabCountsQuery = useQuery({
    queryKey: ["admin", "candidate-counts", token],
    queryFn: () => fetchCandidateTabCounts(token),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !isAdminAuthError(error) && failureCount < 1
  });

  const tabCounts = tabCountsQuery.data;

  useEffect(() => {
    if (isAdminAuthError(candidatesQuery.error)) {
      onAuthFailure();
    }
  }, [candidatesQuery.error, onAuthFailure]);

  useEffect(() => {
    if (isAdminAuthError(tabCountsQuery.error)) {
      onAuthFailure();
    }
  }, [tabCountsQuery.error, onAuthFailure]);

  const items = useMemo(() => candidatesQuery.data?.items ?? [], [candidatesQuery.data]);

  const {
    searchActive,
    listGroups,
    visibleListItems,
    activeId,
    listSeriesDisplayPriorities
  } = useReviewListGroups({
    items,
    statusFilter,
    searchQuery,
    priorityOverrides,
    selectedId,
    onSelect
  });

  const handleAfterDecision = useCallback(
    (candidateId?: string) => {
      if (candidateId) {
        setPriorityOverrides((prev) => clearPriorityOverride(candidateId, prev));
        onSelect(selectNextAfterDecision(visibleListItems, candidateId));
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "candidate-counts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "candidate"] });
    },
    [onSelect, queryClient, visibleListItems]
  );

  const bulk = useReviewBulkActions({
    token,
    activeTab,
    items,
    priorityOverrides,
    setPriorityOverrides,
    onAfterDecision: handleAfterDecision
  });

  const maintenance = useReviewMaintenanceOps(token);

  const bulkActionPending = bulk.isPending || maintenance.isPending;

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

  const handleOpenPrimary = useCallback(
    (primary: LinkedEventCandidate) => {
      const tab = candidateStatusToReviewTab(primary.status);
      if (tab !== activeTab) {
        onActiveTabChange(tab, primary.id);
      } else {
        onSelect(primary.id);
      }
    },
    [activeTab, onActiveTabChange, onSelect]
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
                {formatReviewTabLabel(tab.label, tabCountForReviewTab(tab.id, tabCounts))}
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
                {formatReviewTabLabel(tab.label, tabCountForReviewTab(tab.id, tabCounts))}
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
              onClick={() => maintenance.preApproveAuditMutation.mutate()}
            >
              {maintenance.preApproveAuditMutation.isPending ? (
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
              onClick={() => bulk.approveAllMutation.mutate()}
            >
              {bulk.approveAllMutation.isPending ? (
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
              onClick={() => bulk.approveAllUpdatesMutation.mutate()}
            >
              {bulk.approveAllUpdatesMutation.isPending ? (
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
            onClick={() => {
              void candidatesQuery.refetch();
              void tabCountsQuery.refetch();
            }}
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
        activeOp={maintenance.maintenanceOp}
        isLoading={maintenance.maintenanceLoading}
        result={maintenance.maintenanceResult}
        progressMessage={maintenance.maintenanceOp === "geocode" ? maintenance.geocodeProgress : null}
        onCheck={maintenance.handleMaintenanceCheck}
        onApply={maintenance.handleMaintenanceApply}
        onDismiss={maintenance.dismissMaintenanceResult}
      />

      {activeTab === "new" ? (
        <ReviewQueueAuditPanel
          audit={maintenance.auditResult}
          isLoading={maintenance.preApproveAuditMutation.isPending}
          error={maintenance.auditError}
          onDismiss={maintenance.dismissAudit}
        />
      ) : null}

      {bulk.approveMessage ? (
        <Text variant="body1" tone="onCard" className={styles.message}>
          {bulk.approveMessage}
        </Text>
      ) : null}

      {bulk.deleteMessage ? (
        <Text variant="body1" tone="onCard" className={styles.message}>
          {bulk.deleteMessage}
        </Text>
      ) : null}

      {bulk.selectedIds.size > 0 ? (
        <div className={styles.bulkBar}>
          <span className={styles.bulkBarLabel}>{bulk.selectedIds.size} selected</span>
          <label className={styles.bulkPriorityField}>
            <span className={styles.bulkPriorityLabel}>Priority</span>
            <SelectInput
              className={styles.bulkPrioritySelect}
              value={bulk.bulkPriority}
              onChange={(event) => bulk.setBulkPriority(event.target.value)}
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
            disabled={bulkActionPending || bulk.bulkPriority === ""}
            onClick={() => {
              const priority = Number(bulk.bulkPriority);
              if (
                window.confirm(
                  `Set priority P${priority} on ${bulk.selectedIds.size} selected candidate(s)?`
                )
              ) {
                bulk.bulkPriorityMutation.mutate({ ids: [...bulk.selectedIds], priority });
              }
            }}
          >
            {bulk.bulkPriorityMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Set priority
          </Button>
          {activeTab === "new" ? (
            <Button
              variant="approve"
              size="sm"
              disabled={bulkActionPending}
              onClick={() => bulk.approveSelectedMutation.mutate([...bulk.selectedIds])}
            >
              {bulk.approveSelectedMutation.isPending ? (
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
              onClick={() => bulk.approveSelectedUpdatesMutation.mutate([...bulk.selectedIds])}
            >
              {bulk.approveSelectedUpdatesMutation.isPending ? (
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
                  `Reject ${bulk.selectedIds.size} selected candidate(s)? They will move to the Rejected tab.`
                )
              ) {
                bulk.rejectSelectedMutation.mutate([...bulk.selectedIds]);
              }
            }}
          >
            {bulk.rejectSelectedMutation.isPending ? (
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
              if (window.confirm(`Delete ${bulk.selectedIds.size} candidate(s)? This cannot be undone.`)) {
                bulk.deleteMutation.mutate({ ids: [...bulk.selectedIds], force: false });
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
                  `Force-delete ${bulk.selectedIds.size} candidate(s), including any approved rows?`
                )
              ) {
                bulk.deleteMutation.mutate({ ids: [...bulk.selectedIds], force: true });
              }
            }}
          >
            Force delete
          </Button>
          <Button variant="ghost" size="sm" onClick={bulk.clearSelection}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.listCol}>
          <CandidateList
          groups={listGroups}
          activeId={activeId}
          isLoading={candidatesQuery.isLoading}
          onSelect={onSelect}
          statusFilter={statusFilter}
          selectedIds={bulk.selectedIds}
          priorityOverrides={priorityOverrides}
          seriesDisplayPriorities={listSeriesDisplayPriorities}
          usePublishedPriority={activeTab === "approved"}
          searchMode={searchActive}
          searchQuery={searchQuery}
          onToggleSelected={bulk.handleToggleSelected}
          onSelectAll={bulk.handleSelectAllPage}
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
                {...(candidateQuery.data.primaryCandidate
                  ? { primaryCandidate: candidateQuery.data.primaryCandidate }
                  : {})}
                {...(candidateQuery.data.contentDiff
                  ? { contentDiff: candidateQuery.data.contentDiff }
                  : {})}
                {...(candidateQuery.data.publishedEvent
                  ? { publishedEvent: candidateQuery.data.publishedEvent }
                  : {})}
                {...(candidateQuery.data.publishVenuePreview
                  ? { publishVenuePreview: candidateQuery.data.publishVenuePreview }
                  : {})}
                displayPriority={resolveDetailDisplayPriority(
                  candidateQuery.data.candidate,
                  candidateQuery.data.publishedEvent?.priority,
                  priorityOverrides
                )}
                onAfterDecision={handleAfterDecision}
                onOpenPrimary={handleOpenPrimary}
              />
            ) : (
              <CandidateDetail
                token={token}
                candidate={candidateQuery.data.candidate}
                linkedCandidates={candidateQuery.data.linkedCandidates ?? []}
                nearMatchCandidates={candidateQuery.data.nearMatchCandidates ?? []}
                seriesSiblings={candidateQuery.data.seriesSiblings ?? []}
                {...(candidateQuery.data.primaryCandidate
                  ? { primaryCandidate: candidateQuery.data.primaryCandidate }
                  : {})}
                {...(candidateQuery.data.publishVenuePreview
                  ? { publishVenuePreview: candidateQuery.data.publishVenuePreview }
                  : {})}
                displayPriority={resolveDetailDisplayPriority(
                  candidateQuery.data.candidate,
                  candidateQuery.data.publishedEvent?.priority,
                  priorityOverrides
                )}
                onPriorityChange={handlePriorityChange}
                onAfterDecision={handleAfterDecision}
                onSeriesUpdated={handleSeriesUpdated}
                onSelectCandidate={onSelect}
                onOpenPrimary={handleOpenPrimary}
              />
            )
          ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
