import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

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
import { getPublishedEvent, isAdminAuthError, patchPublishedEvent } from "@/features/admin/admin-api";
import { ErrorBanner } from "@/features/admin-review/AdminReviewDetail.shared";
import { broadcastAdminCache } from "@/features/admin-mode/admin-cache";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";
import { EVENT_DISPLAY_PRIORITY, type Event, type EventCategory, type NormalizedEvent, type Venue } from "@fresno-events/shared";

import styles from "./EventEditorWorkspace.module.css";

interface EventEditorWorkspaceProps {
  token: string;
  eventId: string;
  onAuthFailure: () => void;
}

function publishedEventToNormalized(event: Event, venue: Venue): NormalizedEvent {
  const normalized: NormalizedEvent = {
    source: event.source,
    sourceEventId: event.sourceEventId ?? event.id,
    title: event.title,
    venueName: venue.name,
    startTs: event.startTs
  };

  if (event.descriptionText) {
    normalized.descriptionText = event.descriptionText;
  }
  normalized.category = event.category;
  normalized.venueCity = venue.city;
  if (venue.address) {
    normalized.venueAddress = venue.address;
  }
  if (event.endTs) {
    normalized.endTs = event.endTs;
  }
  normalized.timezone = event.timezone;
  if (event.ticketUrl) {
    normalized.ticketUrl = event.ticketUrl;
  }
  if (event.externalUrl) {
    normalized.externalUrl = event.externalUrl;
  }
  if (event.priceMin !== undefined) {
    normalized.priceMin = event.priceMin;
  }
  if (event.priceMax !== undefined) {
    normalized.priceMax = event.priceMax;
  }

  return normalized;
}

export function EventEditorWorkspace({ token, eventId, onAuthFailure }: EventEditorWorkspaceProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AdminEventFormState | null>(null);
  const [reviewerName, setReviewerName] = useState(() => sessionStorage.getItem("wuf:admin_name") ?? "");

  const eventQuery = useQuery({
    queryKey: adminKeys.publishedEvent(eventId),
    queryFn: () => getPublishedEvent(token, eventId),
    retry: false
  });

  useEffect(() => {
    if (eventQuery.error && isAdminAuthError(eventQuery.error)) {
      onAuthFailure();
    }
  }, [eventQuery.error, onAuthFailure]);

  useEffect(() => {
    if (eventQuery.data) {
      const normalized = publishedEventToNormalized(eventQuery.data.event, eventQuery.data.venue);
      setDraft(
        normalizedEventToFormState(normalized, eventQuery.data.event.priority)
      );
    }
  }, [eventQuery.data]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const originalNormalized = useMemo(() => {
    if (!eventQuery.data) return null;
    return publishedEventToNormalized(eventQuery.data.event, eventQuery.data.venue);
  }, [eventQuery.data]);

  const eventDiff = useMemo(() => {
    if (!draft || !originalNormalized) return {};
    return formStateToEventPatch(originalNormalized, draft);
  }, [draft, originalNormalized]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error("Form is not ready.");
      }
      return patchPublishedEvent(token, eventId, {
        ...(Object.keys(eventDiff).length > 0 ? { event: eventDiff } : {}),
        priority: draft.priority,
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.publishedEvent(eventId) });
      broadcastAdminCache({ type: "event-updated", eventId });
    },
    onError: (error) => {
      if (isAdminAuthError(error)) {
        onAuthFailure();
      }
    }
  });

  if (eventQuery.isLoading || !draft || !eventQuery.data) {
    return (
      <div className={styles.loading}>
        <Loader2 className="size-5 animate-spin" />
        Loading published event…
      </div>
    );
  }

  if (eventQuery.error && !isAdminAuthError(eventQuery.error)) {
    return <ErrorBanner error={eventQuery.error} />;
  }

  const { event, venue } = eventQuery.data;
  const externalUrl = draft.externalUrl.trim();
  const ticketUrl = draft.ticketUrl.trim();

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Published event</p>
          <h1 className={styles.title}>{event.title}</h1>
          <p className={styles.subtitle}>
            {formatPacificDateTimeLabel(event.startTs)} · {venue.name}
          </p>
        </div>
        <div className={styles.actions}>
          <Link to="/event/$slug" params={{ slug: event.slug }} className={styles.viewLink} target="_blank">
            <ExternalLink className="size-4" /> View live
          </Link>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={styles.saveBtn}
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Save changes
          </button>
        </div>
      </header>

      {saveMutation.error ? <ErrorBanner error={saveMutation.error} /> : null}
      {saveMutation.isSuccess ? (
        <div className={styles.successBanner}>Changes saved.</div>
      ) : null}

      <div className={styles.formBody}>
      <div className={styles.formGrid}>
        <FormField label="Title" fullWidth>
          <TextInput
            value={draft.title}
            onChange={(event) => setDraft((d) => (d ? { ...d, title: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Category">
          <SelectInput
            value={draft.category}
            onChange={(event) =>
              setDraft((d) => (d ? { ...d, category: event.target.value as EventCategory } : d))
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
            onChange={(event) => setDraft((d) => (d ? { ...d, startDate: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Start time (Pacific, empty = all day)">
          <TimeInput
            value={draft.startTime}
            onChange={(event) => setDraft((d) => (d ? { ...d, startTime: event.target.value } : d))}
          />
        </FormField>
        <FormField label="End date (Pacific, optional)">
          <DateInput
            value={draft.endDate}
            onChange={(event) => setDraft((d) => (d ? { ...d, endDate: event.target.value } : d))}
          />
        </FormField>
        <FormField label="End time (Pacific, empty = end of day)">
          <TimeInput
            value={draft.endTime}
            onChange={(event) => setDraft((d) => (d ? { ...d, endTime: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Venue name" fullWidth>
          <TextInput
            value={draft.venueName}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueName: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Venue city">
          <TextInput
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueCity: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Venue address">
          <TextInput
            value={draft.venueAddress}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueAddress: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Image URL">
          <TextInput
            value={draft.imageUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, imageUrl: event.target.value } : d))}
          />
        </FormField>
        <FormField
          label="Ticket URL"
          {...(ticketUrl ? { link: { href: ticketUrl } } : {})}
        >
          <TextInput
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, ticketUrl: event.target.value } : d))}
          />
        </FormField>
        <FormField
          label="External URL"
          {...(externalUrl ? { link: { href: externalUrl } } : {})}
        >
          <TextInput
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, externalUrl: event.target.value } : d))}
          />
        </FormField>
        <FormField label="Price min ($)">
          <TextInput
            value={draft.priceMin}
            onChange={(event) => setDraft((d) => (d ? { ...d, priceMin: event.target.value } : d))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price max ($)">
          <TextInput
            value={draft.priceMax}
            onChange={(event) => setDraft((d) => (d ? { ...d, priceMax: event.target.value } : d))}
            inputMode="decimal"
          />
        </FormField>
      </div>

      <FormField label="Description">
        <TextArea
          variant="description"
          rows={10}
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => (d ? { ...d, descriptionText: event.target.value } : d))}
        />
      </FormField>

      <FormField label="Display priority">
        <SelectInput
          value={draft.priority}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft((d) => (d ? { ...d, priority: next } : d));
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
      </div>
    </div>
  );
}
