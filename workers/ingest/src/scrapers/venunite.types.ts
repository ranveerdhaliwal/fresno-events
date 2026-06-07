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

export type VenuniteEvent = z.infer<typeof VenuniteEventSchema>;
export type VenuniteResponse = z.infer<typeof VenuniteResponseSchema>;

export interface VenuniteConfig {
  state: string;
  cities: string;
  sort: string;
  pageDelayMs: number;
  skipModules: string[];
}
