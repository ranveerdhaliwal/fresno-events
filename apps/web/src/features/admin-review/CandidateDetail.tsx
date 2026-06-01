import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { approveCandidate, rejectCandidate } from "../admin/admin-api";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "../admin/admin-form.utils";
import { EVENT_DISPLAY_PRIORITY, type EventCategory } from "@fresno-events/shared";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import { ErrorBanner, Field } from "./AdminReviewDetail.shared";
import { btnClickable, inputClass, type CandidateDetailProps } from "./AdminReviewWorkspace.types";
import { LinkedSourcesSection } from "./LinkedSourcesSection";
import { SeriesSection } from "./SeriesSection";

export function CandidateDetail({
  token,
  candidate,
  linkedCandidates,
  seriesSiblings,
  displayPriority,
  onPriorityChange,
  onAfterDecision
}: CandidateDetailProps) {
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

      {candidate.normalizedEvent.seriesId ? (
        <SeriesSection
          seriesId={candidate.normalizedEvent.seriesId}
          {...(candidate.normalizedEvent.seriesName
            ? { seriesName: candidate.normalizedEvent.seriesName }
            : {})}
          {...(candidate.normalizedEvent.seriesListingRecId
            ? { seriesListingRecId: candidate.normalizedEvent.seriesListingRecId }
            : {})}
          {...(candidate.normalizedEvent.seriesPresentedBy
            ? { seriesPresentedBy: candidate.normalizedEvent.seriesPresentedBy }
            : {})}
          seriesSiblings={seriesSiblings ?? []}
        />
      ) : null}

      <LinkedSourcesSection linkedCandidates={linkedCandidates} />

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
