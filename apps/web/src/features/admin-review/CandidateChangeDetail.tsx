import { useMutation } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import {
  approveCandidateChanges,
  rejectCandidate,
  type AdminApiError
} from "../admin/admin-api";
import { type AdminEventFormState } from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "../admin/admin-form.utils";
import { AdminEventFormFields } from "@/features/admin/AdminEventFormFields";
import { inferAdminPricingHint } from "@/features/admin/admin-pricing-hint.utils";
import { cn } from "@/lib/cn";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import {
  resolveCandidateListingUrl,
  resolveCandidateTicketUrl,
  eventbriteDetailStatusHint
} from "./admin-candidate.utils";
import { changedFormFieldsFromDiff } from "./admin-change-field.utils";
import { ErrorBanner } from "./AdminReviewDetail.shared";
import { CandidateDetailDecisionActions, CandidateDetailDecisionBar } from "./CandidateDetailDecisionActions";
import { PrimaryCandidateBanner } from "./PrimaryCandidateBanner";
import styles from "./AdminReviewWorkspace.module.css";

import type {
  ContentDiffSummary,
  Event,
  EventCandidate,
  LinkedEventCandidate,
  PublishVenuePreview
} from "@fresno-events/shared";

export function CandidateChangeDetail({
  token,
  candidate,
  contentDiff,
  publishedEvent,
  publishVenuePreview,
  displayPriority,
  primaryCandidate,
  onAfterDecision,
  onOpenPrimary,
  onError
}: {
  token: string;
  candidate: EventCandidate;
  contentDiff?: ContentDiffSummary;
  publishedEvent?: Event;
  publishVenuePreview?: PublishVenuePreview;
  displayPriority: number;
  primaryCandidate?: LinkedEventCandidate;
  onAfterDecision: (candidateId?: string) => void;
  onOpenPrimary: (primary: LinkedEventCandidate) => void;
  onError?: (error: AdminApiError | Error) => void;
}) {
  const [draft, setDraft] = useState<AdminEventFormState>(() =>
    normalizedEventToFormState(candidate.normalizedEvent, displayPriority)
  );
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [notes, setNotes] = useState<string>("");
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(normalizedEventToFormState(candidate.normalizedEvent, displayPriority));
    setNotes("");
  }, [candidate.id, displayPriority]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const deferredDraft = useDeferredValue(draft);
  const hasEdits = useMemo(() => {
    return Object.keys(formStateToEventPatch(candidate.normalizedEvent, deferredDraft)).length > 0;
  }, [candidate.normalizedEvent, deferredDraft]);

  const listingUrl = resolveCandidateListingUrl(candidate);
  const ticketUrl = resolveCandidateTicketUrl(candidate);
  const eventbriteTicketHint = eventbriteDetailStatusHint(
    draft.ticketUrl.trim(),
    candidate.eventbriteDetailStatus
  );
  const pricingHint = useMemo(
    () => inferAdminPricingHint(candidate.normalizedEvent),
    [candidate.normalizedEvent]
  );
  const changedFields = useMemo(() => changedFormFieldsFromDiff(contentDiff), [contentDiff]);

  const approveMutation = useMutation({
    mutationFn: () => {
      const currentDraft = draftRef.current;
      const eventOverride = formStateToEventPatch(candidate.normalizedEvent, currentDraft);
      return approveCandidateChanges(token, candidate.id, {
        event: eventOverride,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {}),
        priority: currentDraft.priority
      });
    },
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

  const isLinkedDuplicate = Boolean(candidate.canonicalCandidateId);
  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const decisionError = approveMutation.error ?? rejectMutation.error;

  const handleReject = useCallback(() => rejectMutation.mutate(), [rejectMutation]);
  const handleApprove = useCallback(() => approveMutation.mutate(), [approveMutation]);

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
          <CandidateDetailDecisionActions
            isBusy={isBusy}
            hasEdits={hasEdits}
            onReject={handleReject}
            onApprove={handleApprove}
            approveLabel="Approve update"
            approveWithEditsLabel="Approve update with edits"
            approveDisabled={isLinkedDuplicate}
          />
        </div>
        <div className={styles.detailActionsSecondary}>
          {listingUrl ? (
            <Button variant="secondary" size="sm" href={listingUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              Event page
            </Button>
          ) : null}
          {ticketUrl ? (
            <Button variant="secondary" size="sm" href={ticketUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              Tickets
            </Button>
          ) : null}
          {publishedEvent ? (
            <Button
              variant="secondary"
              size="sm"
              href={`/event/${publishedEvent.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Live calendar
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setShowRaw((value) => !value)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </Button>
        </div>
      </div>

      {primaryCandidate ? (
        <PrimaryCandidateBanner
          primaryCandidate={primaryCandidate}
          onOpenPrimary={() => onOpenPrimary(primaryCandidate)}
        />
      ) : null}

      <p className={styles.updateNotice}>
        The live calendar still shows the published version until you approve this update.
      </p>

      {contentDiff && contentDiff.entries.length > 0 ? (
        <ContentDiffPanel diff={contentDiff} />
      ) : (
        <p className={styles.detailSubtitle}>No field-level diff returned — review the proposed fields below.</p>
      )}

      {changedFields.size > 0 ? (
        <p className={styles.changeHighlightLegend}>
          <span className={styles.changeHighlightLegendSample} aria-hidden />
          Highlighted fields differ from the live calendar.
        </p>
      ) : null}

      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <AdminEventFormFields
        token={token}
        draft={draft}
        setDraft={setDraft}
        displayPriority={displayPriority}
        paletteKeySeed={candidate.id}
        {...(publishVenuePreview ? { publishVenuePreview } : {})}
        highlightFields={changedFields}
        {...(eventbriteTicketHint ? { eventbriteTicketHint } : {})}
        {...(pricingHint ? { pricingHint } : {})}
      />

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

      <CandidateDetailDecisionBar
        isBusy={isBusy}
        hasEdits={hasEdits}
        onReject={handleReject}
        onApprove={handleApprove}
        approveLabel="Approve update"
        approveWithEditsLabel="Approve update with edits"
        className={cn(styles.detailActions, styles.detailActionsBottom)}
      />

      {showRaw ? (
        <details open className={styles.rawJson}>
          <summary>Normalized event JSON</summary>
          <pre>{JSON.stringify(candidate.normalizedEvent, null, 2)}</pre>
        </details>
      ) : null}
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
