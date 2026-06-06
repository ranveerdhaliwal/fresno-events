import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
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

import { ErrorBanner } from "./AdminReviewDetail.shared";
import styles from "./AdminReviewWorkspace.module.css";

import {
  EVENT_DISPLAY_PRIORITY,
  type ContentDiffSummary,
  type Event,
  type EventCandidate,
  type EventCategory
} from "@fresno-events/shared";

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
    <div className={styles.detailForm}>
      <header className={styles.detailHeader}>
        <div>
          <div className={styles.detailMeta}>
            <span className={styles.detailMetaTag}>Update</span>
            <span>{candidate.source}</span>
          </div>
          <h2 className={styles.detailTitle}>{candidate.title}</h2>
          <p className={styles.detailSubtitle}>
            {formatPacificDateTimeLabel(candidate.startTs)} · {candidate.venueName}
          </p>
          {publishedEvent ? (
            <p className={styles.detailSubtitle}>Published slug: {publishedEvent.slug}</p>
          ) : null}
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
            {Object.keys(eventDiff).length > 0 ? "Approve update with edits" : "Approve update"}
          </Button>
        </div>
        {candidate.sourceUrl ? (
          <div className={styles.detailActionsSecondary}>
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
          </div>
        ) : null}
      </div>

      <p className={styles.updateNotice}>
        The live calendar still shows the published version until you approve this update.
      </p>

      {contentDiff && contentDiff.entries.length > 0 ? (
        <ContentDiffPanel diff={contentDiff} />
      ) : (
        <p className={styles.detailSubtitle}>No field-level diff returned — review the form below.</p>
      )}

      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <div className={styles.detailFormGrid}>
        <FormField label="Title (proposed)">
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
      </div>

      <FormField label="Description (proposed)">
        <TextArea
          variant="description"
          rows={10}
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
        />
      </FormField>

      <FormField label="Display priority">
        <SelectInput
          value={draft.priority}
          onChange={(event) => setDraft((d) => ({ ...d, priority: Number(event.target.value) }))}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <div className={cn(styles.detailFormGrid, styles.detailFormGridNotes)}>
        <FormField label="Notes">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />
        </FormField>
        <FormField label="Reviewer">
          <TextInput
            value={reviewerName}
            onChange={(event) => setReviewerName(event.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}

function ContentDiffPanel({ diff }: { diff: ContentDiffSummary }) {
  return (
    <div className={styles.diffPanel}>
      <div className={styles.diffPanelHeader}>
        Changes from published ({diff.changedFields.length})
      </div>
      <ul className={styles.diffPanelList}>
        {diff.entries.map((entry) => (
          <li key={entry.field} className={styles.diffPanelRow}>
            <span className={styles.diffPanelLabel}>{entry.label}</span>
            <span className={styles.diffPanelBefore}>{entry.before ?? "—"}</span>
            <span className={styles.diffPanelAfter}>{entry.after ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
