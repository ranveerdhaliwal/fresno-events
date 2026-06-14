import { z } from "zod";

export const VenuniteVenueSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional()
});

export const VenunitePriceWatchSchema = z
  .object({
    minPriceCents: z.number().nullable().optional(),
    maxPriceCents: z.number().nullable().optional(),
    currency: z.string().optional(),
    displayPrice: z.string().optional(),
    sourcePlatform: z.string().optional(),
    sourceLabel: z.string().optional()
  })
  .nullable()
  .optional();

export const VenuniteVenueDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional()
});

export const VenuniteEventSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  source: z.string(),
  sourceModule: z.string(),
  website: z.string().nullable().optional(),
  ticketUrl: z.string().nullable().optional(),
  venueId: z.number().nullable().optional(),
  venue: VenuniteVenueSchema.nullable().optional(),
  categories: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  priceWatch: VenunitePriceWatchSchema
});

export const VenuniteResponseSchema = z.object({
  events: z.array(VenuniteEventSchema),
  total: z.number(),
  page: z.number(),
  totalPages: z.number()
});

export const VenuniteEventDetailVenueSchema = VenuniteVenueDetailSchema.extend({
  slug: z.string().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  timezone: z.string().nullable().optional()
});

export const VenuniteEventDetailSchema = VenuniteEventSchema.extend({
  description: z.string().nullable().optional(),
  doorTime: z.string().nullable().optional(),
  age: z.string().nullable().optional(),
  agePolicy: z.string().nullable().optional(),
  audienceIntent: z.string().nullable().optional(),
  isCancelled: z.boolean().optional(),
  soldOut: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  artists: z.array(z.unknown()).optional(),
  venue: VenuniteEventDetailVenueSchema.nullable().optional()
});

export type VenuniteEvent = z.infer<typeof VenuniteEventSchema>;
export type VenuniteResponse = z.infer<typeof VenuniteResponseSchema>;
export type VenuniteVenueDetail = z.infer<typeof VenuniteVenueDetailSchema>;
export type VenuniteEventDetail = z.infer<typeof VenuniteEventDetailSchema>;

export interface VenuniteConfig {
  state: string;
  cities: string;
  sort: string;
  pageDelayMs: number;
  venueDetailDelayMs: number;
  eventDetailDelayMs: number;
  skipModules: string[];
  /** Venunite venue slugs to drop (e.g. church ward halls). */
  skipVenueSlugs?: string[];
  /** Case-insensitive venue name substrings to drop. */
  skipVenueNameIncludes?: string[];
}
