import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import { cn } from "@/lib/cn";
import { approveCandidate, patchPublishedEvent, rejectCandidate } from "../admin/admin-api";
import { type AdminEventFormState } from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState, changedAdminFormFieldsFromDraft } from "../admin/admin-form.utils";
import { AdminEventFormFields } from "@/features/admin/AdminEventFormFields";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import { inferAdminPricingHint } from "@/features/admin/admin-pricing-hint.utils";

import { resolveCandidateListingUrl, resolveCandidateTicketUrl, eventbriteDetailStatusHint } from "./admin-candidate.utils";
import { CandidateDetailDecisionActions, CandidateDetailDecisionBar } from "./CandidateDetailDecisionActions";
import { PrimaryCandidateBanner } from "./PrimaryCandidateBanner";
import { ErrorBanner } from "./AdminReviewDetail.shared";
import { type CandidateDetailProps } from "./AdminReviewWorkspace.types";
import styles from "./AdminReviewWorkspace.module.css";
import { LinkedSourcesSection } from "./LinkedSourcesSection";
import { NearMatchSection } from "./NearMatchSection";
import { SeriesLinkPanel } from "./SeriesLinkPanel";

export function CandidateDetail({
  token,
  candidate,
  linkedCandidates,
  nearMatchCandidates = [],
  primaryCandidate,
  seriesSiblings,
  publishVenuePreview,
  displayPriority,
  onPriorityChange,
  onAfterDecision,
  onSeriesUpdated,
  onSelectCandidate,
  onOpenPrimary
}: CandidateDetailProps) {
  const queryClient = useQueryClient();
  const isPendingReview = candidate.status === "pending_review";
  const isPublishedEdit = candidate.status === "approved" && Boolean(candidate.matchedEventId);
  const isLinkedDuplicate = Boolean(candidate.canonicalCandidateId);
  const [draft, setDraft] = useState<AdminEventFormState>(() =>
    normalizedEventToFormState(candidate.normalizedEvent, displayPriority)
  );
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [notes, setNotes] = useState<string>("");
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(normalizedEventToFormState(candidate.normalizedEvent, displayPriority));
    setNotes("");
    setSaveMessage(null);
  }, [candidate.id, candidate.normalizedEvent, displayPriority]);

  const baseline = useMemo(
    () => normalizedEventToFormState(candidate.normalizedEvent, displayPriority),
    [candidate.id, candidate.normalizedEvent, displayPriority]
  );

  const deferredDraft = useDeferredValue(draft);
  const changedFields = useMemo(
    () => changedAdminFormFieldsFromDraft(candidate.normalizedEvent, baseline, deferredDraft),
    [candidate.normalizedEvent, baseline, deferredDraft]
  );
  const hasEdits = changedFields.size > 0;

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const savePublishedMutation = useMutation({
    mutationFn: () => {
      const currentDraft = draftRef.current;
      const eventOverride = formStateToEventPatch(candidate.normalizedEvent, currentDraft);
      const eventId = candidate.matchedEventId;
      if (!eventId) {
        throw new Error("This approved candidate is not linked to a published event.");
      }
      return patchPublishedEvent(token, eventId, {
        event: eventOverride,
        priority: currentDraft.priority,
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      });
    },
    onSuccess: () => {
      setSaveMessage("Saved to the live calendar.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidate", candidate.id, token] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "candidates"] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      const currentDraft = draftRef.current;
      const eventOverride = formStateToEventPatch(candidate.normalizedEvent, currentDraft);
      return approveCandidate(token, candidate.id, {
        event: eventOverride,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {}),
        priority: currentDraft.priority
      });
    },
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

  const isBusy =
    approveMutation.isPending || rejectMutation.isPending || savePublishedMutation.isPending;
  const decisionError =
    approveMutation.error ?? rejectMutation.error ?? savePublishedMutation.error;
  const listingUrl = resolveCandidateListingUrl(candidate);
  const resolvedTicketUrl = resolveCandidateTicketUrl(candidate);
  const eventbriteTicketHint = eventbriteDetailStatusHint(
    draft.ticketUrl.trim(),
    candidate.eventbriteDetailStatus
  );
  const pricingHint = useMemo(
    () => inferAdminPricingHint(candidate.normalizedEvent),
    [candidate.normalizedEvent]
  );

  const handleReject = useCallback(() => rejectMutation.mutate(), [rejectMutation]);
  const handleApprove = useCallback(() => {
    if (isPublishedEdit) {
      savePublishedMutation.mutate();
      return;
    }
    approveMutation.mutate();
  }, [approveMutation, isPublishedEdit, savePublishedMutation]);

  const decisionActionProps = {
    isBusy,
    hasEdits,
    onReject: handleReject,
    onApprove: handleApprove,
    hideReject: isPublishedEdit,
    approveDisabled: (isPublishedEdit && !hasEdits) || (isLinkedDuplicate && !isPublishedEdit),
    approveLabel: isPublishedEdit ? "Save changes" : "Approve",
    approveWithEditsLabel: isPublishedEdit ? "Save changes" : "Approve with edits"
  };

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

      {isPublishedEdit ? (
        <p className={styles.detailSubtitle}>Edits save directly to the live calendar.</p>
      ) : null}

      {isPendingReview || isPublishedEdit ? (
      <div className={styles.detailActions}>
        <div className={styles.detailActionsPrimary}>
          <CandidateDetailDecisionActions {...decisionActionProps} />
        </div>
        <div className={styles.detailActionsSecondary}>
          {listingUrl ? (
            <Button
              variant="secondary"
              size="sm"
              href={listingUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Event page
            </Button>
          ) : null}
          {resolvedTicketUrl ? (
            <Button
              variant="secondary"
              size="sm"
              href={resolvedTicketUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Tickets
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setShowRaw((value) => !value)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </Button>
        </div>
      </div>
      ) : null}

      {primaryCandidate ? (
        <PrimaryCandidateBanner
          primaryCandidate={primaryCandidate}
          onOpenPrimary={() => onOpenPrimary(primaryCandidate)}
        />
      ) : null}

      <LinkedSourcesSection linkedCandidates={linkedCandidates} />

      <NearMatchSection nearMatchCandidates={nearMatchCandidates} onSelectCandidate={onSelectCandidate} />

      {saveMessage ? <p className={styles.pricingHint}>{saveMessage}</p> : null}
      {decisionError ? <ErrorBanner error={decisionError} /> : null}

      <AdminEventFormFields
        token={token}
        draft={draft}
        setDraft={setDraft}
        displayPriority={displayPriority}
        paletteKeySeed={candidate.id}
        {...(publishVenuePreview ? { publishVenuePreview } : {})}
        highlightFields={changedFields}
        {...(candidate.suggestedPriority !== undefined
          ? { suggestedPriority: candidate.suggestedPriority }
          : {})}
        onPriorityChange={(priority) => onPriorityChange(candidate.id, priority)}
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

      {isPendingReview || isPublishedEdit ? (
        <CandidateDetailDecisionBar
          {...decisionActionProps}
          className={cn(styles.detailActions, styles.detailActionsBottom)}
        />
      ) : null}

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
