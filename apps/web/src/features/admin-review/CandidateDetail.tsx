import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/DateInput/DateInput";
import { FormField } from "@/components/FormField/FormField";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import { cn } from "@/lib/cn";
import { approveCandidate, rejectCandidate } from "../admin/admin-api";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "../admin/admin-form.utils";
import { EVENT_DISPLAY_PRIORITY, type EventCategory } from "@fresno-events/shared";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import { ErrorBanner } from "./AdminReviewDetail.shared";
import { type CandidateDetailProps } from "./AdminReviewWorkspace.types";
import styles from "./AdminReviewWorkspace.module.css";
import { LinkedSourcesSection } from "./LinkedSourcesSection";
import { SeriesLinkPanel } from "./SeriesLinkPanel";

export function CandidateDetail({
  token,
  candidate,
  linkedCandidates,
  seriesSiblings,
  displayPriority,
  onPriorityChange,
  onAfterDecision,
  onSeriesUpdated,
  onSelectCandidate
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
  const externalUrl = draft.externalUrl.trim();
  const ticketUrl = draft.ticketUrl.trim();
  return (
    <div className={styles.detailForm}>
      <header className={styles.detailHeader}>
        <div>
          <div className={styles.detailMeta}>
            <span className={styles.detailMetaTag}>{candidate.source}</span>
            <span>Status: {candidate.status}</span>
            {candidate.detailStatus === "pending" ? <span>Detail pending</span> : null}
            <span>Score {(candidate.confidenceScore * 100).toFixed(0)}%</span>
          </div>
          <h2 className={styles.detailTitle}>{candidate.title}</h2>
          <p className={styles.detailSubtitle}>
            {formatPacificDateTimeLabel(candidate.startTs)} · {candidate.venueName}
          </p>
        </div>
      </header>

      <div className={styles.detailActions}>
        <div className={styles.detailActionsPrimary}>
          <Button variant="reject" disabled={isBusy} onClick={() => rejectMutation.mutate()}>
            <X className="size-4" aria-hidden />
            Reject
          </Button>
          <Button variant="approve" disabled={isBusy} onClick={() => approveMutation.mutate()}>
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            {Object.keys(eventDiff).length > 0 ? "Approve with edits" : "Approve"}
          </Button>
        </div>
        <div className={styles.detailActionsSecondary}>
          {candidate.sourceUrl ? (
            <Button
              variant="secondary"
              size="sm"
              href={candidate.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Source
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setShowRaw((value) => !value)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </Button>
        </div>
      </div>

      <LinkedSourcesSection linkedCandidates={linkedCandidates} />

      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <div className={styles.detailFormGrid}>
        <FormField label="Title" fullWidth>
          <TextInput
            value={draft.title}
            onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
          />
        </FormField>
        <FormField label="Category">
          <SelectInput
            value={draft.category}
            onChange={(event) => setDraft((d) => ({ ...d, category: event.target.value as EventCategory }))}
          >
            {ADMIN_EVENT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Start date (Pacific)">
          <DateInput
            value={draft.startDate}
            onChange={(event) => setDraft((d) => ({ ...d, startDate: event.target.value }))}
          />
        </FormField>
        <FormField label="Start time (Pacific, empty = all day)">
          <TimeInput
            value={draft.startTime}
            onChange={(event) => setDraft((d) => ({ ...d, startTime: event.target.value }))}
          />
        </FormField>
        <FormField label="End date (Pacific, optional)">
          <DateInput
            value={draft.endDate}
            onChange={(event) => setDraft((d) => ({ ...d, endDate: event.target.value }))}
          />
        </FormField>
        <FormField label="End time (Pacific, empty = end of day)">
          <TimeInput
            value={draft.endTime}
            onChange={(event) => setDraft((d) => ({ ...d, endTime: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue name" fullWidth>
          <TextInput
            value={draft.venueName}
            onChange={(event) => setDraft((d) => ({ ...d, venueName: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue city">
          <TextInput
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => ({ ...d, venueCity: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue address">
          <TextInput
            value={draft.venueAddress}
            onChange={(event) => setDraft((d) => ({ ...d, venueAddress: event.target.value }))}
          />
        </FormField>
        <FormField label="Image URL">
          <TextInput
            value={draft.imageUrl}
            onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
          />
        </FormField>
        <FormField
          label="Ticket URL"
          {...(ticketUrl ? { link: { href: ticketUrl } } : {})}
        >
          <TextInput
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => ({ ...d, ticketUrl: event.target.value }))}
          />
        </FormField>
        <FormField
          label="External URL"
          {...(externalUrl ? { link: { href: externalUrl } } : {})}
        >
          <TextInput
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => ({ ...d, externalUrl: event.target.value }))}
          />
        </FormField>
        <FormField label="Price min ($)">
          <TextInput
            value={draft.priceMin}
            onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price max ($)">
          <TextInput
            value={draft.priceMax}
            onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price notes (CMS text)" fullWidth>
          <TextInput
            value={draft.priceNotes}
            onChange={(event) => setDraft((d) => ({ ...d, priceNotes: event.target.value }))}
            placeholder='e.g. "Free", "see website for details"'
          />
        </FormField>
      </div>

      <FormField label="Description">
        <TextArea
          variant="description"
          rows={10}
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
        />
      </FormField>

      <FormField
        label="Display priority (published event)"
        hint={
          candidate.suggestedPriority !== undefined ? (
            <>
              Suggested P{candidate.suggestedPriority}
              {candidate.suggestedPriority !== draft.priority ? " · you overrode" : ""}
            </>
          ) : undefined
        }
      >
        <SelectInput
          value={draft.priority}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft((d) => ({ ...d, priority: next }));
            onPriorityChange(candidate.id, next);
          }}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label} ({tier.description})
            </option>
          ))}
        </SelectInput>
      </FormField>

      <div className={cn(styles.detailFormGrid, styles.detailFormGridNotes)}>
        <FormField label="Notes for review log">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="What did you change or why are you rejecting?"
          />
        </FormField>
        <FormField label="Reviewer">
          <TextInput
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
            placeholder="your name"
          />
        </FormField>
      </div>

      {showRaw ? (
        <details open className={styles.rawJson}>
          <summary>Normalized event JSON</summary>
          <pre>{JSON.stringify(candidate.normalizedEvent, null, 2)}</pre>
        </details>
      ) : null}

      <footer className={styles.detailSeriesFooter}>
        <SeriesLinkPanel
          token={token}
          candidate={candidate}
          seriesSiblings={seriesSiblings ?? []}
          onSelectCandidate={onSelectCandidate}
          onSeriesUpdated={onSeriesUpdated}
        />
      </footer>
    </div>
  );
}
