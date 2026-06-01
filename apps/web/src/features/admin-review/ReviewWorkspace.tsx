import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LogOut, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  AdminApiError,
  bulkApproveAllPending,
  bulkApproveCandidates,
  bulkApproveChanges,
  bulkApproveChangesAll,
  deleteCandidates,
  getCandidate,
  isAdminAuthError,
  listCandidates,
  reviewTabToStatus
} from "../admin/admin-api";
import {
  clearPriorityOverride,
  effectivePriority,
  groupCandidatesByPriority,
  readPriorityOverrides,
  sortCandidatesForReview,
  writePriorityOverrides
} from "../admin/admin-priority.utils";

import { DetailLoading, EmptyDetail, ErrorBanner } from "./AdminReviewDetail.shared";
import {
  btnClickable,
  PRIMARY_TABS,
  SECONDARY_TABS,
  TAB_COPY,
  type ReviewWorkspaceProps
} from "./AdminReviewWorkspace.types";
import styles from "./AdminReviewWorkspace.module.css";
import { CandidateChangeDetail } from "./CandidateChangeDetail";
import { CandidateDetail } from "./CandidateDetail";
import { CandidateList } from "./CandidateList";

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
  const sortedItems = useMemo(
    () => sortCandidatesForReview(items, priorityOverrides),
    [items, priorityOverrides]
  );
  const priorityGroups = useMemo(
    () => groupCandidatesByPriority(sortedItems, priorityOverrides),
    [sortedItems, priorityOverrides]
  );
  const activeId = selectedId ?? sortedItems[0]?.id ?? null;

  useEffect(() => {
    if (selectedId && !sortedItems.some((item) => item.id === selectedId)) {
      onSelect(null);
    }
  }, [sortedItems, selectedId, onSelect]);

  useEffect(() => {
    setSelectedIds(new Set());
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

  const bulkActionPending =
    deleteMutation.isPending ||
    approveSelectedMutation.isPending ||
    approveAllMutation.isPending ||
    approveSelectedUpdatesMutation.isPending ||
    approveAllUpdatesMutation.isPending;

  const candidateQuery = useQuery({
    queryKey: ["admin", "candidate", activeId, token],
    queryFn: () => (activeId ? getCandidate(token, activeId) : Promise.resolve(null)),
    enabled: Boolean(activeId)
  });

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>{TAB_COPY[activeTab].title}</h1>
          <p className={styles.subtitle}>{TAB_COPY[activeTab].subtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {PRIMARY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onActiveTabChange(tab.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  btnClickable,
                  activeTab === tab.id
                    ? "bg-amber-300 text-neutral-900"
                    : "border border-neutral-700 text-neutral-300 hover:border-neutral-500"
                )}
              >
                {tab.label}
                {tab.id === "new" && activeTab === "new" ? ` (${items.length})` : ""}
                {tab.id === "updates" && activeTab === "updates" ? ` (${items.length})` : ""}
              </button>
            ))}
            <span className="text-neutral-600">|</span>
            {SECONDARY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onActiveTabChange(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs uppercase tracking-wide transition",
                  btnClickable,
                  activeTab === tab.id
                    ? "border border-neutral-400 text-neutral-100"
                    : "border border-neutral-800 text-neutral-500 hover:border-neutral-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          {activeTab === "new" ? (
            <button
              type="button"
              disabled={bulkActionPending || candidatesQuery.isLoading}
              onClick={() => {
                const count = items.length;
                if (
                  window.confirm(
                    `Approve all pending candidates in the database? (Listed: ${count} on this page.) Uses suggested priority per row.`
                  )
                ) {
                  approveAllMutation.mutate();
                }
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 text-sm text-emerald-100 hover:border-emerald-400",
                btnClickable
              )}
            >
              {approveAllMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve all pending
            </button>
          ) : null}
          {activeTab === "updates" ? (
            <button
              type="button"
              disabled={bulkActionPending || candidatesQuery.isLoading}
              onClick={() => {
                if (window.confirm(`Approve all ${items.length} listed update(s)?`)) {
                  approveAllUpdatesMutation.mutate();
                }
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 text-sm text-emerald-100 hover:border-emerald-400",
                btnClickable
              )}
            >
              {approveAllUpdatesMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve all updates
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => candidatesQuery.refetch()}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-4 text-sm hover:border-neutral-500",
              btnClickable
            )}
          >
            <RefreshCcw className="size-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={onChangeToken}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-4 text-sm text-neutral-300 hover:border-rose-500/60 hover:text-rose-200",
              btnClickable
            )}
          >
            <LogOut className="size-3.5" /> Change token
          </button>
        </div>
      </header>

      {candidatesQuery.isError ? (
        <ErrorBanner error={candidatesQuery.error} />
      ) : null}

      {approveMessage ? <p className={styles.message}>{approveMessage}</p> : null}

      {deleteMessage ? <p className={styles.message}>{deleteMessage}</p> : null}

      {selectedIds.size > 0 ? (
        <div className={styles.bulkBar}>
          <span className="text-sm text-neutral-200">{selectedIds.size} selected</span>
          {activeTab === "new" ? (
            <button
              type="button"
              disabled={bulkActionPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Approve ${selectedIds.size} selected candidate(s)? Uses each row's suggested priority.`
                  )
                ) {
                  approveSelectedMutation.mutate([...selectedIds]);
                }
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-3 text-sm text-emerald-100 hover:border-emerald-400",
                btnClickable
              )}
            >
              {approveSelectedMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve selected
            </button>
          ) : null}
          {activeTab === "updates" ? (
            <button
              type="button"
              disabled={bulkActionPending}
              onClick={() => {
                if (window.confirm(`Approve ${selectedIds.size} selected update(s)?`)) {
                  approveSelectedUpdatesMutation.mutate([...selectedIds]);
                }
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/40 px-3 text-sm text-emerald-100 hover:border-emerald-400",
                btnClickable
              )}
            >
              {approveSelectedUpdatesMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve selected updates
            </button>
          ) : null}
          <button
            type="button"
            disabled={bulkActionPending}
            onClick={() => {
              if (window.confirm(`Delete ${selectedIds.size} candidate(s)? This cannot be undone.`)) {
                deleteMutation.mutate({ ids: [...selectedIds], force: false });
              }
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border border-rose-500/60 px-3 text-sm text-rose-200 hover:bg-rose-500/10",
              btnClickable
            )}
          >
            <Trash2 className="size-3.5" /> Delete selected
          </button>
          <button
            type="button"
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
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border border-neutral-600 px-3 text-sm text-neutral-300 hover:border-neutral-400",
              btnClickable
            )}
          >
            Force delete
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className={cn("text-sm text-neutral-400 hover:text-neutral-200", btnClickable)}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.listCol}>
          <CandidateList
          groups={priorityGroups}
          activeId={activeId}
          isLoading={candidatesQuery.isLoading}
          onSelect={onSelect}
          statusFilter={statusFilter}
          selectedIds={selectedIds}
          priorityOverrides={priorityOverrides}
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
          onSelectAll={() => {
            setSelectedIds((prev) => {
              if (prev.size === sortedItems.length) {
                return new Set();
              }
              return new Set(sortedItems.map((item) => item.id));
            });
          }}
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
              />
            )
          ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
