import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import {
  ADMIN_EVENT_CATEGORIES,
  type AdminEventFormState
} from "@/features/admin/admin-form.types";
import { formStateToEventPatch, normalizedEventToFormState } from "@/features/admin/admin-form.utils";
import { adminKeys } from "@/features/admin/admin.queryKeys";
import { getPublishedEvent, isAdminAuthError, patchPublishedEvent } from "@/features/admin/admin-api";
import { ErrorBanner, Field } from "@/features/admin-review/AdminReviewDetail.shared";
import { btnClickable, inputClass } from "@/features/admin-review/AdminReviewWorkspace.types";
import { broadcastAdminCache } from "@/features/admin-mode/admin-cache";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";
import { cn } from "@/lib/cn";
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(event) => setDraft((d) => (d ? { ...d, title: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Category">
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((d) => (d ? { ...d, category: event.target.value as EventCategory } : d))
            }
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
            onChange={(event) => setDraft((d) => (d ? { ...d, startDate: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Start time (Pacific, empty = all day)">
          <input
            type="time"
            value={draft.startTime}
            onChange={(event) => setDraft((d) => (d ? { ...d, startTime: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="End date (Pacific, optional)">
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft((d) => (d ? { ...d, endDate: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="End time (Pacific, empty = end of day)">
          <input
            type="time"
            value={draft.endTime}
            onChange={(event) => setDraft((d) => (d ? { ...d, endTime: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue name">
          <input
            value={draft.venueName}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueName: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue city">
          <input
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueCity: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Venue address">
          <input
            value={draft.venueAddress}
            onChange={(event) => setDraft((d) => (d ? { ...d, venueAddress: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Image URL">
          <input
            value={draft.imageUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, imageUrl: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Ticket URL">
          <input
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, ticketUrl: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="External URL">
          <input
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => (d ? { ...d, externalUrl: event.target.value } : d))}
            className={inputClass}
          />
        </Field>
        <Field label="Price min ($)">
          <input
            value={draft.priceMin}
            onChange={(event) => setDraft((d) => (d ? { ...d, priceMin: event.target.value } : d))}
            className={inputClass}
            inputMode="decimal"
          />
        </Field>
        <Field label="Price max ($)">
          <input
            value={draft.priceMax}
            onChange={(event) => setDraft((d) => (d ? { ...d, priceMax: event.target.value } : d))}
            className={inputClass}
            inputMode="decimal"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => (d ? { ...d, descriptionText: event.target.value } : d))}
          rows={5}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <Field label="Display priority">
        <select
          value={draft.priority}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDraft((d) => (d ? { ...d, priority: next } : d));
          }}
          className={inputClass}
        >
          {EVENT_DISPLAY_PRIORITY.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.value} — {tier.label} ({tier.description})
            </option>
          ))}
        </select>
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
  );
}
