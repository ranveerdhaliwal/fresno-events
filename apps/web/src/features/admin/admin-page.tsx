import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, LogOut, RefreshCcw, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  AdminApiError,
  approveCandidate,
  type CandidateStatusFilter,
  getCandidate,
  listCandidates,
  rejectCandidate
} from "./admin-api";

import type { EventCandidate, EventCategory, NormalizedEvent } from "@fresno-events/shared";

const TOKEN_STORAGE_KEY = "wuf:admin_token";

const STATUS_FILTERS: Array<{ value: CandidateStatusFilter; label: string }> = [
  { value: "pending_review", label: "Pending review" },
  { value: "needs_changes", label: "Needs changes" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }
];

const CATEGORY_OPTIONS: EventCategory[] = [
  "music",
  "comedy",
  "theater",
  "art",
  "food_drink",
  "sports",
  "family",
  "community"
];

export function AdminPage() {
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

  const candidatesQuery = useQuery({
    queryKey: ["admin", "candidates", statusFilter, token],
    queryFn: () => listCandidates(token, statusFilter),
    refetchOnWindowFocus: false
  });

  const items = candidatesQuery.data?.items ?? [];
  const activeId = selectedId ?? items[0]?.id ?? null;

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      onSelect(null);
    }
  }, [items, selectedId, onSelect]);

  const candidateQuery = useQuery({
    queryKey: ["admin", "candidate", activeId, token],
    queryFn: () => (activeId ? getCandidate(token, activeId) : Promise.resolve(null)),
    enabled: Boolean(activeId)
  });

  const handleAfterDecision = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "candidate"] });
  };

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300/80">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight md:text-3xl">Review queue</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-300">
            Triage incoming candidates from the ingest worker. Edit the canonical fields, then approve to publish or
            reject with notes for the source owner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as CandidateStatusFilter)}
            className="h-9 rounded-full border border-neutral-700 bg-neutral-900 px-4 text-sm focus:border-amber-300 focus:outline-none"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => candidatesQuery.refetch()}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-4 text-sm hover:border-neutral-500"
          >
            <RefreshCcw className="size-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-neutral-700 px-4 text-sm text-neutral-300 hover:border-rose-500/60 hover:text-rose-200"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </header>

      {candidatesQuery.isError ? (
        <ErrorBanner error={candidatesQuery.error} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <CandidateList
          items={items}
          activeId={activeId}
          isLoading={candidatesQuery.isLoading}
          onSelect={onSelect}
          statusFilter={statusFilter}
        />

        <section className="rounded-3xl border border-neutral-800 bg-neutral-950/40 p-5">
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
              onAfterDecision={handleAfterDecision}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CandidateList({
  items,
  activeId,
  isLoading,
  statusFilter,
  onSelect
}: {
  items: EventCandidate[];
  activeId: string | null;
  isLoading: boolean;
  statusFilter: CandidateStatusFilter;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-neutral-800 bg-neutral-950/40 p-5 text-sm text-neutral-400">
        <Loader2 className="size-4 animate-spin" /> Loading candidates...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/30 p-6 text-sm text-neutral-400">
        No candidates with status <span className="font-medium text-neutral-200">{statusFilter}</span>.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((candidate) => {
        const isActive = candidate.id === activeId;
        return (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => onSelect(candidate.id)}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left transition",
                isActive
                  ? "border-amber-300/70 bg-amber-300/10"
                  : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-600"
              )}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
                <span>{candidate.source}</span>
                <span>{formatRelative(candidate.startTs)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-neutral-100">{candidate.title}</p>
              <p className="mt-1 line-clamp-1 text-xs text-neutral-400">
                {candidate.venueName} · score {(candidate.confidenceScore * 100).toFixed(0)}%
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CandidateDetail({
  token,
  candidate,
  onAfterDecision
}: {
  token: string;
  candidate: EventCandidate;
  onAfterDecision: () => void;
}) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(candidate.normalizedEvent));
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [notes, setNotes] = useState<string>("");
  const [showRaw, setShowRaw] = useState<boolean>(false);

  useEffect(() => {
    setDraft(toDraft(candidate.normalizedEvent));
    setNotes("");
  }, [candidate.id, candidate.normalizedEvent]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const eventDiff = useMemo(() => buildPatch(candidate.normalizedEvent, draft), [candidate.normalizedEvent, draft]);

  const approveMutation = useMutation({
    mutationFn: () =>
      approveCandidate(token, candidate.id, {
        ...(Object.keys(eventDiff).length > 0 ? { event: eventDiff } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: () => {
      onAfterDecision();
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectCandidate(token, candidate.id, {
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: () => {
      onAfterDecision();
    }
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const decisionError = approveMutation.error ?? rejectMutation.error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-neutral-400">
            <span className="rounded-full border border-neutral-700 px-2 py-0.5">{candidate.source}</span>
            <span>Status: {candidate.status}</span>
            <span>Score {(candidate.confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-50">{candidate.title}</h2>
          <p className="mt-1 text-sm text-neutral-300">
            {formatDateTime(candidate.startTs)} · {candidate.venueName}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          {candidate.sourceUrl ? (
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 hover:border-amber-300/70"
            >
              <ExternalLink className="size-3" /> Source
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setShowRaw((value) => !value)}
            className="rounded-full border border-neutral-700 px-3 py-1 hover:border-neutral-500"
          >
            {showRaw ? "Hide" : "Show"} raw JSON
          </button>
        </div>
      </header>

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
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start (ISO)">
          <input
            value={draft.startTs}
            onChange={(event) => setDraft((d) => ({ ...d, startTs: event.target.value }))}
            className={inputClass}
            placeholder="2026-05-15T19:30:00-07:00"
          />
        </Field>
        <Field label="End (ISO, optional)">
          <input
            value={draft.endTs}
            onChange={(event) => setDraft((d) => ({ ...d, endTs: event.target.value }))}
            className={inputClass}
            placeholder="leave blank for unknown"
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

      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => rejectMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-full border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="size-4" /> Reject
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => approveMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {Object.keys(eventDiff).length > 0 ? "Approve with edits" : "Approve"}
        </button>
      </div>
    </div>
  );
}

function TokenGate({ onAuthenticate }: { onAuthenticate: (token: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-md space-y-5 rounded-3xl border border-neutral-800 bg-neutral-950/60 p-7"
    >
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
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-semibold text-neutral-900 transition hover:bg-amber-200"
        >
          Connect to review API
        </button>
      </form>
    </motion.div>
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

const inputClass =
  "w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-amber-300 focus:outline-none";

interface DraftState {
  title: string;
  descriptionText: string;
  category: EventCategory;
  startTs: string;
  endTs: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  imageUrl: string;
  ticketUrl: string;
  externalUrl: string;
  priceMin: string;
  priceMax: string;
}

function toDraft(event: NormalizedEvent): DraftState {
  return {
    title: event.title,
    descriptionText: event.descriptionText ?? "",
    category: event.category ?? "community",
    startTs: event.startTs,
    endTs: event.endTs ?? "",
    venueName: event.venueName,
    venueCity: event.venueCity ?? "",
    venueAddress: event.venueAddress ?? "",
    imageUrl: event.imageUrl ?? "",
    ticketUrl: event.ticketUrl ?? "",
    externalUrl: event.externalUrl ?? "",
    priceMin: event.priceMin?.toString() ?? "",
    priceMax: event.priceMax?.toString() ?? ""
  };
}

function buildPatch(original: NormalizedEvent, draft: DraftState): Partial<NormalizedEvent> {
  const patch: Partial<NormalizedEvent> = {};

  setIfDifferent(patch, "title", draft.title.trim() || original.title, original.title);
  setIfDifferent(patch, "category", draft.category, original.category);
  setIfDifferent(patch, "startTs", draft.startTs.trim() || original.startTs, original.startTs);
  setIfDifferent(patch, "venueName", draft.venueName.trim() || original.venueName, original.venueName);

  assignOptional(patch, "descriptionText", draft.descriptionText, original.descriptionText);
  assignOptional(patch, "venueCity", draft.venueCity, original.venueCity);
  assignOptional(patch, "venueAddress", draft.venueAddress, original.venueAddress);
  assignOptional(patch, "imageUrl", draft.imageUrl, original.imageUrl);
  assignOptional(patch, "ticketUrl", draft.ticketUrl, original.ticketUrl);
  assignOptional(patch, "externalUrl", draft.externalUrl, original.externalUrl);
  assignOptional(patch, "endTs", draft.endTs, original.endTs);

  assignNumberOptional(patch, "priceMin", draft.priceMin, original.priceMin);
  assignNumberOptional(patch, "priceMax", draft.priceMax, original.priceMax);

  return patch;
}

function setIfDifferent<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: NormalizedEvent[K],
  original: NormalizedEvent[K]
) {
  if (value !== original) {
    patch[key] = value;
  }
}

function assignOptional<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: string,
  original: NormalizedEvent[K] | undefined
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  if (trimmed !== (original ?? "")) {
    patch[key] = trimmed as NormalizedEvent[K];
  }
}

function assignNumberOptional<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: string,
  original: NormalizedEvent[K] | undefined
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return;
  }
  if (parsed !== original) {
    patch[key] = parsed as NormalizedEvent[K];
  }
}

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

function formatRelative(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
