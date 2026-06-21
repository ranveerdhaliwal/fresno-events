import { eventCategories, type EventCategory } from "@fresno-events/shared";

export type { EventCategory };

export interface AdminEventFormState {
  title: string;
  descriptionText: string;
  category: EventCategory;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  /** Public site shows "All day" (mutually exclusive with start time and time TBA). */
  allDay: boolean;
  /** Source has a date but no announced wall time (`timeUnknown` on normalized event). */
  timeTba: boolean;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  venueLat: string;
  venueLng: string;
  imageUrl: string;
  ticketUrl: string;
  externalUrl: string;
  /** Public list/detail show "Free" when checked. */
  isFree: boolean;
  priceMin: string;
  priceMax: string;
  /** Detail-page copy when price is not numeric (not shown on list rows). */
  priceNotes: string;
  priority: number;
  /** Map pin: empty = auto; "pin" = default marker; emoji = override */
  mapPinEmoji: string;
}

export const ADMIN_EVENT_CATEGORIES = eventCategories;
