import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  approveCandidateChanges,
  rejectCandidate,
  type AdminApiError
} from "../admin/admin-api";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "../admin/admin-form.utils";
import { cn } from "@/lib/cn";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import {
  EVENT_DISPLAY_PRIORITY,
  type ContentDiffSummary,
  type Event,
  type EventCandidate,
  type EventCategory
} from "@fresno-events/shared";

const btnClickable = "cursor-pointer disabled:cursor-not-allowed";
const inputClass =
  "w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-amber-300/70";

export function CandidateChangeDetail({
  token,
  candidate,
  contentDiff,
  publishedEvent,
  displayPriority,
  onAfterDecision,
  onError
}: {
  token: string;
  candidate: EventCandidate;
  contentDiff?: ContentDiffSummary;
  publishedEvent?: Event;
  displayPriority: number;
  onAfterDecision: (candidateId?: string) => void;
  onError?: (error: AdminApiError | Error) => void;
}) {
  const [draft, setDraft] = useState<AdminEventFormState>(() =>
    normalizedEventToFormState(candidate.normalizedEvent, displayPriority)
  );
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [notes, setNotes] = useState<string>("");

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
      approveCandidateChanges(token, candidate.id, {
        ...(Object.keys(eventDiff).length > 0 ? { event: eventDiff } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {}),
        priority: draft.priority
      }),
    onSuccess: () => onAfterDecision(candidate.id),
    onError: (error) => onError?.(error)
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectCandidate(token, candidate.id, {
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: () => onAfterDecision(candidate.id),
    onError: (error) => onError?.(error)
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const decisionError = approveMutation.error ?? rejectMutation.error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-neutral-400">
            <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-amber-200">Update</span>
            <span>{candidate.source}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-50">{candidate.title}</h2>
          <p className="mt-1 text-sm text-neutral-300">
            {formatPacificDateTimeLabel(candidate.startTs)} · {candidate.venueName}
          </p>
          {publishedEvent ? (
            <p className="mt-1 text-xs text-neutral-500">Published slug: {publishedEvent.slug}</p>
          ) : null}
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
            {Object.keys(eventDiff).length > 0 ? "Approve update with edits" : "Approve update"}
          </button>
        </div>
      </header>

      <p className="rounded-xl border border-amber-400/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90">
        The live calendar still shows the published version until you approve this update.
      </p>

      {contentDiff && contentDiff.entries.length > 0 ? (
        <ContentDiffPanel diff={contentDiff} />
      ) : (
        <p className="text-sm text-neutral-400">No field-level diff returned — review the form below.</p>
      )}

      {candidate.sourceUrl ? (
        <a
          href={candidate.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-amber-300/70"
        >
          <ExternalLink className="size-3" /> Source
        </a>
      ) : null}

      {decisionError ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {decisionError instanceof Error ? decisionError.message : "Action failed."}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title (proposed)">
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
      </div>

      <Field label="Description (proposed)">
        <textarea
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
          rows={4}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Display priority">
        <select
          value={draft.priority}
          onChange={(event) => setDraft((d) => ({ ...d, priority: Number(event.target.value) }))}
          className={inputClass}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className={cn(inputClass, "resize-y")}
          />
        </Field>
        <Field label="Reviewer">
          <input
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

function ContentDiffPanel({ diff }: { diff: ContentDiffSummary }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
        Changes from published ({diff.changedFields.length})
      </div>
      <ul className="divide-y divide-neutral-800">
        {diff.entries.map((entry) => (
          <li key={entry.field} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[120px_1fr_1fr]">
            <span className="font-medium text-neutral-300">{entry.label}</span>
            <span className="text-neutral-500 line-through">{entry.before ?? "—"}</span>
            <span className="text-amber-100">{entry.after ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs uppercase tracking-[0.18em] text-neutral-400">
      {label}
      {children}
    </label>
  );
}
