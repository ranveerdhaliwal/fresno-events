import { useMutation } from "@tanstack/react-query";
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
import {
  approveCandidateChanges,
  rejectCandidate,
  type AdminApiError
} from "../admin/admin-api";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "../admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState, applyAdminStartTimeChange } from "../admin/admin-form.utils";
import { AdminScheduleOptions } from "@/features/admin/AdminScheduleOptions";
import { inferAdminPricingHint } from "@/features/admin/admin-pricing-hint.utils";
import { AdminLocationPicker } from "@/features/admin-location/AdminLocationPicker";
import { cn } from "@/lib/cn";
import { paletteKeyForCategory } from "@/lib/image-palette";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";

import {
  resolveCandidateListingUrl,
  resolveCandidateTicketUrl
} from "./admin-candidate.utils";
import { changedFormFieldsFromDiff, type ChangeFormFieldKey } from "./admin-change-field.utils";
import { ErrorBanner } from "./AdminReviewDetail.shared";
import { CandidateDetailDecisionActions, CandidateDetailDecisionBar } from "./CandidateDetailDecisionActions";
import styles from "./AdminReviewWorkspace.module.css";

import {
  MAP_PIN_EMOJI_PRESETS,
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY,
  type ContentDiffSummary,
  type Event,
  type EventCandidate,
  type EventCategory,
  type PublishVenuePreview
} from "@fresno-events/shared";

export function CandidateChangeDetail({
  token,
  candidate,
  contentDiff,
  publishedEvent,
  publishVenuePreview,
  displayPriority,
  onAfterDecision,
  onError
}: {
  token: string;
  candidate: EventCandidate;
  contentDiff?: ContentDiffSummary;
  publishedEvent?: Event;
  publishVenuePreview?: PublishVenuePreview;
  displayPriority: number;
  onAfterDecision: (candidateId?: string) => void;
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
  const externalUrl = draft.externalUrl.trim();
  const draftTicketUrl = draft.ticketUrl.trim();
  const pricingHint = useMemo(
    () => inferAdminPricingHint(candidate.normalizedEvent),
    [candidate.normalizedEvent]
  );
  const changedFields = useMemo(() => changedFormFieldsFromDiff(contentDiff), [contentDiff]);
  const fieldChanged = (key: ChangeFormFieldKey) => changedFields.has(key);
  const venueLocationChanged =
    fieldChanged("venueLocation") ||
    fieldChanged("venueAddress") ||
    fieldChanged("venueCity") ||
    fieldChanged("venueName");

  const handleVenueCoordsChange = useCallback((coords: { lat: string; lng: string }) => {
    setDraft((d) => ({ ...d, venueLat: coords.lat, venueLng: coords.lng }));
  }, []);

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

      <div className={styles.detailFormGrid}>
        <FormField label="Title" fullWidth highlightChanged={fieldChanged("title")}>
          <TextInput
            value={draft.title}
            onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
          />
        </FormField>
        <FormField label="Category" highlightChanged={fieldChanged("category")}>
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
        <div
          className={cn(
            styles.detailFormDateTimePair,
            fieldChanged("start") && styles.proposedFieldGroupChanged
          )}
        >
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
        <div
          className={cn(
            styles.detailFormDateTimePair,
            fieldChanged("end") && styles.proposedFieldGroupChanged
          )}
        >
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
        <FormField label="Venue name" fullWidth highlightChanged={fieldChanged("venueName")}>
          <TextInput
            value={draft.venueName}
            onChange={(event) => setDraft((d) => ({ ...d, venueName: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue city" highlightChanged={fieldChanged("venueCity")}>
          <TextInput
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => ({ ...d, venueCity: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue address" highlightChanged={fieldChanged("venueAddress")}>
          <TextInput
            value={draft.venueAddress}
            onChange={(event) => setDraft((d) => ({ ...d, venueAddress: event.target.value }))}
          />
        </FormField>
      </div>

      <FormField label="Venue location" fullWidth highlightChanged={venueLocationChanged}>
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
          highlightChanged={fieldChanged("ticketUrl")}
          {...(draftTicketUrl ? { link: { href: draftTicketUrl } } : {})}
        >
          <TextInput
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => ({ ...d, ticketUrl: event.target.value }))}
          />
        </FormField>
        <FormField
          label="External URL"
          fullWidth
          highlightChanged={fieldChanged("externalUrl")}
          {...(externalUrl ? { link: { href: externalUrl } } : {})}
        >
          <TextInput
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => ({ ...d, externalUrl: event.target.value }))}
          />
        </FormField>
        <FormField label="Price min ($)" highlightChanged={fieldChanged("priceMin")}>
          <TextInput
            value={draft.priceMin}
            onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price max ($)" highlightChanged={fieldChanged("priceMax")}>
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

      <FormField label="Description" highlightChanged={fieldChanged("descriptionText")}>
        <TextArea
          variant="description"
          rows={10}
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
        />
      </FormField>

      <FormField label="Display priority (published event)">
        <SelectInput
          value={draft.priority}
          onChange={(event) => setDraft((d) => ({ ...d, priority: Number(event.target.value) }))}
        >
          {ORGANIC_CANDIDATE_DISPLAY_PRIORITY.map((tier) => (
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
