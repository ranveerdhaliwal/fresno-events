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
  priceMin: string;
  priceMax: string;
  priceNotes: string;
  priority: number;
  /** Map pin: empty = auto; "pin" = default marker; emoji = override */
  mapPinEmoji: string;
}

export const ADMIN_EVENT_CATEGORIES = eventCategories;
