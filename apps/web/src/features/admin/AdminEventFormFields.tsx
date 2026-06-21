import { useCallback } from "react";

import { DateInput } from "@/components/DateInput/DateInput";
import { FormField } from "@/components/FormField/FormField";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { TextArea } from "@/components/TextArea/TextArea";
import { TextInput } from "@/components/TextInput/TextInput";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import { AdminLocationPicker } from "@/features/admin-location/AdminLocationPicker";
import { cn } from "@/lib/cn";
import { paletteKeyForCategory } from "@/lib/image-palette";
import {
  MAP_PIN_EMOJI_PRESETS,
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY,
  type EventCategory,
  type PublishVenuePreview
} from "@fresno-events/shared";

import styles from "../admin-review/AdminReviewWorkspace.module.css";

import { AdminPricingOptions } from "./AdminPricingOptions";
import { AdminScheduleOptions } from "./AdminScheduleOptions";
import { ADMIN_EVENT_CATEGORIES, type AdminEventFormState } from "./admin-form.types";
import { applyAdminStartTimeChange } from "./admin-form.utils";
import type { AdminPricingHint } from "./admin-pricing-hint.utils";

export interface AdminEventFormFieldsProps {
  token: string;
  draft: AdminEventFormState;
  setDraft: React.Dispatch<React.SetStateAction<AdminEventFormState>>;
  displayPriority: number;
  paletteKeySeed: string;
  publishVenuePreview?: PublishVenuePreview;
  highlightFields?: ReadonlySet<string>;
  suggestedPriority?: number;
  onPriorityChange?: (priority: number) => void;
  eventbriteTicketHint?: string | null;
  pricingHint?: AdminPricingHint | null;
  showDisplayPriority?: boolean;
}

export function AdminEventFormFields({
  token,
  draft,
  setDraft,
  displayPriority,
  paletteKeySeed,
  publishVenuePreview,
  highlightFields,
  suggestedPriority,
  onPriorityChange,
  eventbriteTicketHint,
  pricingHint,
  showDisplayPriority = true
}: AdminEventFormFieldsProps) {
  const changed = (key: string) => highlightFields?.has(key) ?? false;
  const startChanged = changed("start");
  const endChanged = changed("end");
  const venueLocationChanged =
    changed("venueLocation") ||
    changed("venueAddress") ||
    changed("venueCity") ||
    changed("venueName");

  const externalUrl = draft.externalUrl.trim();
  const ticketUrl = draft.ticketUrl.trim();

  const handleVenueCoordsChange = useCallback((coords: { lat: string; lng: string }) => {
    setDraft((d) => ({ ...d, venueLat: coords.lat, venueLng: coords.lng }));
  }, [setDraft]);

  return (
    <>
      {showDisplayPriority ? (
        <FormField
          label="Display priority (published event)"
          highlightChanged={changed("priority")}
          hint={
            suggestedPriority !== undefined ? (
              <>
                Suggested P{suggestedPriority}
                {suggestedPriority !== draft.priority ? " · you overrode" : ""}
              </>
            ) : undefined
          }
        >
          <SelectInput
            value={draft.priority}
            onChange={(event) => {
              const next = Number(event.target.value);
              setDraft((d) => ({ ...d, priority: next }));
              onPriorityChange?.(next);
            }}
          >
            {ORGANIC_CANDIDATE_DISPLAY_PRIORITY.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.value} — {tier.label} ({tier.description})
              </option>
            ))}
          </SelectInput>
        </FormField>
      ) : null}

      <div className={styles.detailFormGrid}>
        <FormField label="Title" fullWidth highlightChanged={changed("title")}>
          <TextInput
            value={draft.title}
            onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
          />
        </FormField>
        <FormField label="Category" highlightChanged={changed("category")}>
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
        <FormField label="Map pin" highlightChanged={changed("mapPinEmoji")}>
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
          <FormField label="Start date (Pacific)" highlightChanged={startChanged}>
            <DateInput
              value={draft.startDate}
              onChange={(event) => setDraft((d) => ({ ...d, startDate: event.target.value }))}
            />
          </FormField>
          <FormField label="Start time (Pacific)" highlightChanged={startChanged}>
            <TimeInput
              value={draft.startTime}
              onChange={(event) =>
                setDraft((d) => applyAdminStartTimeChange(d, event.target.value))
              }
            />
          </FormField>
        </div>
        <AdminScheduleOptions draft={draft} onChange={setDraft} highlightChanged={startChanged} />
        <div className={styles.detailFormDateTimePair}>
          <FormField label="End date (Pacific, optional)" highlightChanged={endChanged}>
            <DateInput
              value={draft.endDate}
              onChange={(event) => setDraft((d) => ({ ...d, endDate: event.target.value }))}
            />
          </FormField>
          <FormField
            label="End time (Pacific, optional — empty with end date = 11:59 PM)"
            highlightChanged={endChanged}
          >
            <TimeInput
              value={draft.endTime}
              onChange={(event) => setDraft((d) => ({ ...d, endTime: event.target.value }))}
            />
          </FormField>
        </div>
      </div>

      <div className={styles.detailFormGrid}>
        <FormField label="Image URL" fullWidth highlightChanged={changed("imageUrl")}>
          <div
            className={cn(
              styles.imageUrlField,
              displayPriority === 5 && styles.imageUrlFieldWithPreview
            )}
          >
            {displayPriority === 5 ? (
              <div className={styles.imageUrlPreview} aria-hidden>
                <PlaceholderImage
                  paletteKey={paletteKeyForCategory(draft.category, paletteKeySeed)}
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
          highlightChanged={changed("ticketUrl")}
          {...(ticketUrl ? { link: { href: ticketUrl } } : {})}
          {...(eventbriteTicketHint ? { hint: eventbriteTicketHint } : {})}
        >
          <TextInput
            value={draft.ticketUrl}
            onChange={(event) => setDraft((d) => ({ ...d, ticketUrl: event.target.value }))}
          />
        </FormField>
        <FormField
          label="External URL"
          fullWidth
          highlightChanged={changed("externalUrl")}
          {...(externalUrl ? { link: { href: externalUrl } } : {})}
        >
          <TextInput
            value={draft.externalUrl}
            onChange={(event) => setDraft((d) => ({ ...d, externalUrl: event.target.value }))}
          />
        </FormField>
        <AdminPricingOptions
          draft={draft}
          onChange={setDraft}
          highlightChanged={changed("isFree")}
        />
        <FormField label="Price min ($)" highlightChanged={changed("priceMin")}>
          <TextInput
            value={draft.priceMin}
            disabled={draft.isFree}
            onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price max ($)" highlightChanged={changed("priceMax")}>
          <TextInput
            value={draft.priceMax}
            disabled={draft.isFree}
            onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
            inputMode="decimal"
          />
        </FormField>
        <FormField label="Price notes (detail page)" fullWidth highlightChanged={changed("priceNotes")}>
          <TextInput
            value={draft.priceNotes}
            onChange={(event) => setDraft((d) => ({ ...d, priceNotes: event.target.value }))}
            placeholder='e.g. "Donations welcome"'
          />
        </FormField>
        {pricingHint?.kind === "unknown" ? (
          <p className={styles.pricingHint}>{pricingHint.label}</p>
        ) : null}
      </div>

      <FormField label="Description" highlightChanged={changed("descriptionText")}>
        <TextArea
          variant="description"
          value={draft.descriptionText}
          onChange={(event) => setDraft((d) => ({ ...d, descriptionText: event.target.value }))}
        />
      </FormField>

      <div className={styles.detailFormGrid}>
        <FormField label="Venue name" fullWidth highlightChanged={changed("venueName")}>
          <TextInput
            value={draft.venueName}
            onChange={(event) => setDraft((d) => ({ ...d, venueName: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue city" highlightChanged={changed("venueCity")}>
          <TextInput
            value={draft.venueCity}
            onChange={(event) => setDraft((d) => ({ ...d, venueCity: event.target.value }))}
          />
        </FormField>
        <FormField label="Venue address" highlightChanged={changed("venueAddress")}>
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
    </>
  );
}
