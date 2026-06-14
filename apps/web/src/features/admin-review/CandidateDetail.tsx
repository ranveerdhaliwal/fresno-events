import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/DateInput/DateInput";
import { FormField } from "@/components/FormField/FormField";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import { cn } from "@/lib/cn";
import { approveCandidate, patchPublishedEvent, rejectCandidate } from "../admin/admin-api";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState, applyAdminStartTimeChange } from "../admin/admin-form.utils";
import { AdminScheduleOptions } from "@/features/admin/AdminScheduleOptions";
import {
  MAP_PIN_EMOJI_PRESETS,
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY,
  type EventCategory
} from "@fresno-events/shared";
import { paletteKeyForCategory } from "@/lib/image-palette";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import { inferAdminPricingHint } from "@/features/admin/admin-pricing-hint.utils";
import { AdminLocationPicker } from "@/features/admin-location/AdminLocationPicker";

import { resolveCandidateListingUrl, resolveCandidateTicketUrl } from "./admin-candidate.utils";
import { CandidateDetailDecisionActions, CandidateDetailDecisionBar } from "./CandidateDetailDecisionActions";
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
  publishVenuePreview,
  displayPriority,
  onPriorityChange,
  onAfterDecision,
  onSeriesUpdated,
  onSelectCandidate
}: CandidateDetailProps) {
  const queryClient = useQueryClient();
  const isPendingReview = candidate.status === "pending_review";
  const isPublishedEdit = candidate.status === "approved" && Boolean(candidate.matchedEventId);
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
  const externalUrl = draft.externalUrl.trim();
  const ticketUrl = draft.ticketUrl.trim();
  const pricingHint = useMemo(
    () => inferAdminPricingHint(candidate.normalizedEvent),
    [candidate.normalizedEvent]
  );

  const handleVenueCoordsChange = useCallback((coords: { lat: string; lng: string }) => {
    setDraft((d) => ({ ...d, venueLat: coords.lat, venueLng: coords.lng }));
  }, []);

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
    approveDisabled: isPublishedEdit && !hasEdits,
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

      <LinkedSourcesSection linkedCandidates={linkedCandidates} />

      {saveMessage ? <p className={styles.pricingHint}>{saveMessage}</p> : null}
      {decisionError ? <ErrorBanner error={decisionError} /> : null}

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
          {ORGANIC_CANDIDATE_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label} ({tier.description})
            </option>
          ))}
        </SelectInput>
      </FormField>

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
        <FormField label="Map pin">
          <SelectInput
            value={draft.mapPinEmoji}
            onChange={(event) => setDraft((d) => ({ ...d, mapPinEmoji: event.target.value }))}
          >
            {MAP_PIN_EMOJI_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <div className={styles.detailFormDateTimePair}>
          <FormField label="Start date (Pacific)">
            <DateInput
              value={draft.startDate}
              onChange={(event) => setDraft((d) => ({ ...d, startDate: event.target.value }))}
            />
          </FormField>
          <FormField label="Start time (Pacific)">
            <TimeInput
              value={draft.startTime}
              onChange={(event) =>
                setDraft((d) => applyAdminStartTimeChange(d, event.target.value))
              }
            />
          </FormField>
        </div>
        <AdminScheduleOptions draft={draft} onChange={setDraft} />
        <div className={styles.detailFormDateTimePair}>
          <FormField label="End date (Pacific, optional)">
            <DateInput
              value={draft.endDate}
              onChange={(event) => setDraft((d) => ({ ...d, endDate: event.target.value }))}
            />
          </FormField>
          <FormField label="End time (Pacific, optional — empty with end date = 11:59 PM)">
            <TimeInput
              value={draft.endTime}
              onChange={(event) => setDraft((d) => ({ ...d, endTime: event.target.value }))}
            />
          </FormField>
        </div>
      </div>

      <div className={styles.detailFormGrid}>
        <FormField label="Image URL" fullWidth>
          <div
            className={cn(
              styles.imageUrlField,
              displayPriority === 5 && styles.imageUrlFieldWithPreview
            )}
          >
            {displayPriority === 5 ? (
              <div className={styles.imageUrlPreview} aria-hidden>
                <PlaceholderImage
                  paletteKey={paletteKeyForCategory(draft.category, candidate.id)}
                  label={draft.category}
                  imageUrl={draft.imageUrl.trim() || null}
                />
              </div>
            ) : null}
            <TextInput
              value={draft.imageUrl}
              onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
            />
          </div>
        </FormField>
        <FormField
          label="Ticket URL"
          fullWidth
          {...(ticketUrl ? { link: { href: ticketUrl } } : {})}
        >
          <TextInput
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => ({ ...d, ticketUrl: event.target.value }))}
          />
        </FormField>
        <FormField
          label="External URL"
          fullWidth
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
        {pricingHint?.kind === "unknown" ? (
          <p className={styles.pricingHint}>{pricingHint.label}</p>
        ) : null}
      </div>

      <FormField label="Description">
        <TextArea
          variant="description"
          rows={10}
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
        />
      </FormField>

      <div className={styles.detailFormGrid}>
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
      </div>

      <FormField label="Venue location" fullWidth>
        <AdminLocationPicker
          token={token}
          lat={draft.venueLat}
          lng={draft.venueLng}
          address={draft.venueAddress}
          city={draft.venueCity}
          {...(publishVenuePreview ? { publishVenuePreview } : {})}
          onChange={handleVenueCoordsChange}
        />
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
