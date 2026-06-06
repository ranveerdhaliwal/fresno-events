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
  venueName: string;
  venueCity: string;
  venueAddress: string;
  imageUrl: string;
  ticketUrl: string;
  externalUrl: string;
  priceMin: string;
  priceMax: string;
  priceNotes: string;
  priority: number;
}

export const ADMIN_EVENT_CATEGORIES = eventCategories;
