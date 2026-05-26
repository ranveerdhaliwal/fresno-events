import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, RefreshCcw, ShieldAlert, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  AdminApiError,
  approveCandidate,
  bulkApproveAllPending,
  bulkApproveCandidates,
  type CandidateStatusFilter,
  deleteCandidates,
  getCandidate,
  listCandidates,
  rejectCandidate
} from "../admin/admin-api";

import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "../admin/admin-form.utils";
import {
  clearPriorityOverride,
  effectivePriority,
  groupCandidatesByPriority,
  readPriorityOverrides,
  sortCandidatesForReview,
  writePriorityOverrides
} from "../admin/admin-priority.utils";

import { CandidateList } from "./CandidateList";
import styles from "./AdminReviewWorkspace.module.css";

import {
  EVENT_DISPLAY_PRIORITY,
  type EventCandidate,
  type EventCategory
} from "@fresno-events/shared";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

const TOKEN_STORAGE_KEY = "wuf:admin_token";

const btnClickable = "cursor-pointer disabled:cursor-not-allowed";

const STATUS_FILTERS: Array<{ value: CandidateStatusFilter; label: string }> = [
  { value: "pending_review", label: "Pending review" },
  { value: "needs_changes", label: "Needs changes" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }
];

export function AdminReviewWorkspace() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [statusFilter, setStatusFilter] = useState<CandidateStatusFilter>("pending_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!token) {
    return (
      <TokenGate
        onAuthenticate={(value) => {
          persistToken(value);
          setToken(value);
        }}
      />
    );
  }

  return (
    <ReviewWorkspace
      token={token}
      statusFilter={statusFilter}
      onStatusFilterChange={(value) => {
        setStatusFilter(value);
        setSelectedId(null);
      }}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onSignOut={() => {
        persistToken(null);
        setToken(null);
        setSelectedId(null);
      }}
    />
  );
}

function ReviewWorkspace({
  token,
  statusFilter,
  onStatusFilterChange,
  selectedId,
  onSelect,
  onSignOut
}: {
  token: string;
  statusFilter: CandidateStatusFilter;
  onStatusFilterChange: (value: CandidateStatusFilter) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, number>>(() =>
    readPriorityOverrides()
  );

  const candidatesQuery = useQuery({
    queryKey: ["admin", "candidates", statusFilter, token],
    queryFn: () => listCandidates(token, statusFilter),
    refetchOnWindowFocus: false
  });

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
  }, [statusFilter]);

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

  const bulkActionPending =
    deleteMutation.isPending || approveSelectedMutation.isPending || approveAllMutation.isPending;

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
          <h1 className={styles.title}>Review queue</h1>
          <p className={styles.subtitle}>
            Triage incoming candidates from the ingest worker. Edit the canonical fields, then approve to publish or
            reject with notes for the source owner.
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as CandidateStatusFilter)}
            className={styles.select}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {statusFilter === "pending_review" ? (
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
            onClick={onSignOut}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-4 text-sm text-neutral-300 hover:border-rose-500/60 hover:text-rose-200",
              btnClickable
            )}
          >
            <LogOut className="size-3.5" /> Sign out
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
          {statusFilter === "pending_review" ? (
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
            <CandidateDetail
              token={token}
              candidate={candidateQuery.data.candidate}
              displayPriority={effectivePriority(candidateQuery.data.candidate, priorityOverrides)}
              onPriorityChange={handlePriorityChange}
              onAfterDecision={handleAfterDecision}
            />
          ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function CandidateDetail({
  token,
  candidate,
  displayPriority,
  onPriorityChange,
  onAfterDecision
}: {
  token: string;
  candidate: EventCandidate;
  displayPriority: number;
  onPriorityChange: (candidateId: string, priority: number) => void;
  onAfterDecision: (candidateId?: string) => void;
}) {
  const [draft, setDraft] = useState<AdminEventFormState>(() =>
    normalizedEventToFormState(candidate.normalizedEvent, displayPriority)
  );
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [notes, setNotes] = useState<string>("");
  const [showRaw, setShowRaw] = useState<boolean>(false);

  useEffect(() => {
    setDraft(normalizedEventToFormState(candidate.normalizedEvent, displayPriority));
    setNotes("");
  }, [candidate.id, candidate.normalizedEvent, displayPriority]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const eventDiff = useMemo(
    () => formStateToEventPatch(candidate.normalizedEvent, draft),
    [candidate.normalizedEvent, draft]
  );

  const approveMutation = useMutation({
    mutationFn: () =>
      approveCandidate(token, candidate.id, {
        ...(Object.keys(eventDiff).length > 0 ? { event: eventDiff } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {}),
        priority: draft.priority
      }),
    onSuccess: () => {
      onAfterDecision(candidate.id);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectCandidate(token, candidate.id, {
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: () => {
      onAfterDecision(candidate.id);
    }
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const decisionError = approveMutation.error ?? rejectMutation.error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-neutral-400">
            <span className="rounded-full border border-neutral-700 px-2 py-0.5">{candidate.source}</span>
            <span>Status: {candidate.status}</span>
            <span>Score {(candidate.confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-50">{candidate.title}</h2>
          <p className="mt-1 text-sm text-neutral-300">
            {formatPacificDateTimeLabel(candidate.startTs)} · {candidate.venueName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => rejectMutation.mutate()}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20",
              btnClickable,
              "disabled:opacity-60"
            )}
          >
            <X className="size-4" /> Reject
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => approveMutation.mutate()}
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200",
              btnClickable,
              "disabled:opacity-60"
            )}
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {Object.keys(eventDiff).length > 0 ? "Approve with edits" : "Approve"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        {candidate.sourceUrl ? (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 hover:border-amber-300/70"
          >
            <ExternalLink className="size-3" /> Source
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => setShowRaw((value) => !value)}
          className={cn("rounded-full border border-neutral-700 px-3 py-1 hover:border-neutral-500", btnClickable)}
        >
          {showRaw ? "Hide" : "Show"} raw JSON
        </button>
      </div>

      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Category">
          <select
            value={draft.category}
            onChange={(event) => setDraft((d) => ({ ...d, category: event.target.value as EventCategory }))}
            className={inputClass}
          >
            {ADMIN_EVENT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date (Pacific)">
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft((d) => ({ ...d, startDate: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Start time (Pacific, empty = all day)">
          <input
            type="time"
            value={draft.startTime}
            onChange={(event) => setDraft((d) => ({ ...d, startTime: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="End date (Pacific, optional)">
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft((d) => ({ ...d, endDate: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="End time (Pacific, empty = end of day)">
          <input
            type="time"
            value={draft.endTime}
            onChange={(event) => setDraft((d) => ({ ...d, endTime: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue name">
          <input
            value={draft.venueName}
            onChange={(event) => setDraft((d) => ({ ...d, venueName: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue city">
          <input
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => ({ ...d, venueCity: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue address">
          <input
            value={draft.venueAddress}
            onChange={(event) => setDraft((d) => ({ ...d, venueAddress: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Image URL">
          <input
            value={draft.imageUrl}
            onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Ticket URL">
          <input
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => ({ ...d, ticketUrl: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="External URL">
          <input
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => ({ ...d, externalUrl: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Price min ($)">
          <input
            value={draft.priceMin}
            onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
            className={inputClass}
            inputMode="decimal"
          />
        </Field>
        <Field label="Price max ($)">
          <input
            value={draft.priceMax}
            onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
            className={inputClass}
            inputMode="decimal"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
          rows={5}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Display priority (published event)">
        <select
          value={draft.priority}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft((d) => ({ ...d, priority: next }));
            onPriorityChange(candidate.id, next);
          }}
          className={inputClass}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label} ({tier.description})
            </option>
          ))}
        </select>
        {candidate.suggestedPriority !== undefined ? (
          <p className="mt-1 text-[11px] normal-case tracking-normal text-neutral-500">
            AI suggested P{candidate.suggestedPriority}
            {candidate.suggestedPriority !== draft.priority ? " · you overrode" : ""}
          </p>
        ) : null}
      </Field>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <Field label="Notes for review log">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="What did you change or why are you rejecting?"
            className={cn(inputClass, "resize-y")}
          />
        </Field>
        <Field label="Reviewer">
          <input
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
            placeholder="your name"
            className={inputClass}
          />
        </Field>
      </div>

      {showRaw ? (
        <details open className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 text-xs">
          <summary className="cursor-pointer text-neutral-300">Normalized event JSON</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] text-neutral-200">
            {JSON.stringify(candidate.normalizedEvent, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function TokenGate({ onAuthenticate }: { onAuthenticate: (token: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className={styles.tokenGate}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-300">
          <KeyRound className="size-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-400">Admin</p>
          <h1 className="text-lg font-semibold">Enter the review token</h1>
        </div>
      </div>
      <p className="text-sm text-neutral-300">
        Paste your <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">ADMIN_REVIEW_TOKEN</code>. It is held
        in this browser tab only and never sent anywhere except the review API.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) {
            onAuthenticate(value.trim());
          }
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="paste token"
          className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-sm focus:border-amber-300 focus:outline-none"
        />
        <button
          type="submit"
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200",
            btnClickable
          )}
        >
          Connect to review API
        </button>
      </form>
    </div>
  );
}

function EmptyDetail({ statusFilter }: { statusFilter: CandidateStatusFilter }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center text-sm text-neutral-400">
      <ShieldAlert className="size-6" />
      <p>
        Select a candidate from the list to review. Currently filtering by{" "}
        <span className="font-medium text-neutral-200">{statusFilter}</span>.
      </p>
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-neutral-400">
      <Loader2 className="size-4 animate-spin" /> Loading candidate...
    </div>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  const message = error instanceof AdminApiError
    ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <div className="flex items-center gap-2 text-rose-200">
        <ShieldAlert className="size-4" />
        <span className="font-medium">Request failed</span>
      </div>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs uppercase tracking-[0.18em] text-neutral-400">
      <span>{label}</span>
      <div className="normal-case tracking-normal text-neutral-100">{children}</div>
    </label>
  );
}

const inputClass = styles.input;

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistToken(value: string | null) {
  try {
    if (value) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

