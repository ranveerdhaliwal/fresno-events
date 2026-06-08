import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button/Button";
import { DateInput } from "@/components/DateInput/DateInput";
import { FormField } from "@/components/FormField/FormField";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "@/features/admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "@/features/admin/admin-form.utils";
import { adminKeys } from "@/features/admin/admin.queryKeys";
import { patchPublishedEvent } from "@/features/admin/admin-api";
import { ErrorBanner } from "@/features/admin-review/AdminReviewDetail.shared";
import { broadcastAdminCache } from "@/features/admin-mode/admin-cache";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";
import {
  EVENT_DISPLAY_PRIORITY,
  type AdminPublishedEventResponse,
  type EventCategory
} from "@fresno-events/shared";

import { AdminLocationPicker } from "@/features/admin-location/AdminLocationPicker";

import { publishedEventToNormalized } from "./published-event-normalize.utils";
import styles from "../admin-review/AdminReviewWorkspace.module.css";

export interface PublishedEventDetailProps {
  token: string;
  detail: AdminPublishedEventResponse;
  onSaved?: () => void;
}

export function PublishedEventDetail({ token, detail, onSaved }: PublishedEventDetailProps) {
  const queryClient = useQueryClient();
  const { event, venue } = detail;
  const baseline = useMemo(() => publishedEventToNormalized(event, venue, detail.heroImage), [detail, event, venue]);

  const [draft, setDraft] = useState<AdminEventFormState>(() =>
    normalizedEventToFormState(baseline, event.priority)
  );
  const [reviewerName, setReviewerName] = useState(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setDraft(normalizedEventToFormState(baseline, event.priority));
  }, [baseline, event.id, event.priority]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const eventDiff = useMemo(() => formStateToEventPatch(baseline, draft), [baseline, draft]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchPublishedEvent(token, event.id, {
        ...(Object.keys(eventDiff).length > 0 ? { event: eventDiff } : {}),
        priority: draft.priority,
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.publishedEvent(event.id) });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "published-events"] });
      broadcastAdminCache({ type: "event-updated", eventId: event.id });
      onSaved?.();
    }
  });

  const externalUrl = draft.externalUrl.trim();
  const ticketUrl = draft.ticketUrl.trim();
  const isBusy = saveMutation.isPending;

  return (
    <div className={styles.detailForm}>
      <header className={styles.detailHeader}>
        <div>
          <div className={styles.detailMeta}>
            <span className={styles.detailMetaTag}>{event.source}</span>
            <span>Status: {event.status.replace(/_/g, " ")}</span>
            <span>P{event.priority}</span>
          </div>
          <h2 className={styles.detailTitle}>{event.title}</h2>
          <p className={styles.detailSubtitle}>
            {formatPacificDateTimeLabel(event.startTs)} · {venue.name}
          </p>
        </div>
      </header>

      <div className={styles.detailActions}>
        <div className={styles.detailActionsPrimary}>
          <Button variant="approve" disabled={isBusy} onClick={() => saveMutation.mutate()}>
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            {Object.keys(eventDiff).length > 0 ? "Save changes" : "Save priority"}
          </Button>
        </div>
        <div className={styles.detailActionsSecondary}>
          <Button variant="secondary" size="sm" href={`/event/${event.slug}`} target="_blank">
            <ExternalLink className="size-3.5" aria-hidden />
            View live
          </Button>
          {event.externalUrl ? (
            <Button variant="secondary" size="sm" href={event.externalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              Source
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => setShowRaw((value) => !value)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </Button>
        </div>
      </div>

      {saveMutation.error ? <ErrorBanner error={saveMutation.error} /> : null}
      {saveMutation.isSuccess ? (
        <p className={styles.updateNotice}>Changes saved to the live event.</p>
      ) : null}

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
            onChange={(event) =>
              setDraft((d) => ({ ...d, category: event.target.value as EventCategory }))
            }
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
      </div>

      <FormField label="Venue location" fullWidth>
        <AdminLocationPicker
          token={token}
          lat={draft.venueLat}
          lng={draft.venueLng}
          address={draft.venueAddress}
          city={draft.venueCity}
          onChange={(coords) => setDraft((d) => ({ ...d, ...coords }))}
        />
      </FormField>

      <div className={styles.detailFormGrid}>
        <FormField label="Image URL" fullWidth>
          <TextInput
            value={draft.imageUrl}
            onChange={(event) => setDraft((d) => ({ ...d, imageUrl: event.target.value }))}
          />
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
      </div>

      <FormField label="Description">
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
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft((d) => ({ ...d, priority: next }));
          }}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label} ({tier.description})
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label="Reviewer">
        <TextInput
          value={reviewerName}
          onChange={(event) => setReviewerName(event.target.value)}
          placeholder="your name"
        />
      </FormField>

      {showRaw ? (
        <details open className={styles.rawJson}>
          <summary>Published event JSON</summary>
          <pre>{JSON.stringify({ event, venue }, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
