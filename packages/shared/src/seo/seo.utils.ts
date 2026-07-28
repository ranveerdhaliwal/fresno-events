import type { Event, EventCategory, EventStatus, Venue } from "../index.js";

export const SITE_ORIGIN = "https://whatupfresno.com";
export const SITE_NAME = "What Up Fresno";
export const DEFAULT_SITE_DESCRIPTION =
  "What Up Fresno is building one place to find concerts, festivals, food, art, sports, and community events across Fresno and the Central Valley.";
export const DEFAULT_OG_IMAGE_PATH = "/brand/nav-mark.svg";

const PACIFIC_TZ = "America/Los_Angeles";

export interface SeoHeadInput {
  title: string;
  description: string;
  canonicalPath: string;
  ogImageUrl?: string | null;
  ogType?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export interface OgTagSet {
  title: string;
  description: string;
  url: string;
  image: string;
  type: string;
}

export interface TwitterTagSet {
  card: "summary_large_image";
  title: string;
  description: string;
  image: string;
}

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function defaultOgImageUrl(): string {
  return canonicalUrl(DEFAULT_OG_IMAGE_PATH);
}

export function resolveOgImageUrl(heroImageUrl?: string | null): string {
  const trimmed = heroImageUrl?.trim();
  if (!trimmed) {
    return defaultOgImageUrl();
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return canonicalUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

export function truncateMetaDescription(text: string, maxLength = 160): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildHomeTitle(): string {
  return `${SITE_NAME} — Events in Fresno & the Central Valley`;
}

export function buildHomeDescription(): string {
  return truncateMetaDescription(DEFAULT_SITE_DESCRIPTION);
}

export function buildEventTitle(event: Pick<Event, "title">, venue: Pick<Venue, "name">): string {
  return `${event.title} · ${venue.name} · ${SITE_NAME}`;
}

export function buildEventDescription(
  event: Pick<Event, "title" | "descriptionText" | "startTs">,
  venue: Pick<Venue, "name">
): string {
  const when = formatPacificEventDate(event.startTs);
  const lead = `${event.title} at ${venue.name} in Fresno on ${when}.`;
  const body = event.descriptionText?.trim();
  if (!body) {
    return truncateMetaDescription(lead);
  }
  return truncateMetaDescription(`${lead} ${body}`);
}

export function buildEventIntroSentence(
  event: Pick<Event, "title" | "startTs" | "category">,
  venue: Pick<Venue, "name">
): string {
  const when = formatPacificEventDate(event.startTs);
  const categoryLabel = formatCategoryLabel(event.category);
  return `${event.title} is a ${categoryLabel} event at ${venue.name} in Fresno on ${when}.`;
}

export function buildVenueTitle(venue: Pick<Venue, "name">): string {
  return `${venue.name} · Events in Fresno · ${SITE_NAME}`;
}

export function buildVenueDescription(
  venue: Pick<Venue, "name" | "description" | "city">,
  upcomingCount: number
): string {
  const countLabel = upcomingCount === 1 ? "1 upcoming event" : `${upcomingCount} upcoming events`;
  const lead = `${countLabel} at ${venue.name} in ${venue.city || "Fresno"}.`;
  const body = venue.description?.trim();
  if (!body) {
    return truncateMetaDescription(lead);
  }
  return truncateMetaDescription(`${lead} ${body}`);
}

export function buildDayTitle(isoDate: string): string {
  return `Events on ${formatPacificDayTitle(isoDate)} · ${SITE_NAME}`;
}

export function buildDayDescription(isoDate: string, eventCount: number): string {
  const day = formatPacificDayTitle(isoDate);
  const countLabel = eventCount === 1 ? "1 event" : `${eventCount} events`;
  return truncateMetaDescription(`Browse ${countLabel} in Fresno on ${day}.`);
}

export function buildCalendarTitle(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: PACIFIC_TZ
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return `Fresno events calendar · ${label} · ${SITE_NAME}`;
}

export function buildCalendarDescription(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: PACIFIC_TZ
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return truncateMetaDescription(`Browse concerts, festivals, sports, and community events in Fresno for ${label}.`);
}

export function buildOgTags(input: {
  title: string;
  description: string;
  canonicalPath: string;
  ogImageUrl?: string | null;
  type?: string;
}): OgTagSet {
  return {
    title: input.title,
    description: input.description,
    url: canonicalUrl(input.canonicalPath),
    image: resolveOgImageUrl(input.ogImageUrl),
    type: input.type ?? "website"
  };
}

export function buildTwitterTags(input: {
  title: string;
  description: string;
  ogImageUrl?: string | null;
}): TwitterTagSet {
  return {
    card: "summary_large_image",
    title: input.title,
    description: input.description,
    image: resolveOgImageUrl(input.ogImageUrl)
  };
}

export function buildRobotsContent(noindex: boolean): string | null {
  return noindex ? "noindex, nofollow" : null;
}

export function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_ORIGIN}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path)
    }))
  };
}

export function buildEventJsonLd(input: {
  event: Pick<
    Event,
    | "title"
    | "descriptionText"
    | "startTs"
    | "endTs"
    | "status"
    | "category"
    | "slug"
    | "isFree"
    | "priceMin"
    | "priceMax"
    | "currency"
    | "ticketUrl"
    | "externalUrl"
  >;
  venue: Pick<Venue, "name" | "address" | "city" | "lat" | "lng" | "slug">;
  heroImageUrl?: string | null;
}): Record<string, unknown> {
  const { event, venue } = input;
  const eventUrl = canonicalUrl(`/event/${event.slug}`);
  const venueUrl = venue.slug ? canonicalUrl(`/venue/${venue.slug}`) : undefined;
  const type = event.category === "music" ? "MusicEvent" : "Event";

  const location: Record<string, unknown> = {
    "@type": "Place",
    name: venue.name,
    address: {
      "@type": "PostalAddress",
      ...(venue.address ? { streetAddress: venue.address } : {}),
      addressLocality: venue.city || "Fresno",
      addressRegion: "CA",
      addressCountry: "US"
    }
  };

  if (venue.lat != null && venue.lng != null) {
    location.geo = {
      "@type": "GeoCoordinates",
      latitude: venue.lat,
      longitude: venue.lng
    };
  }

  if (venueUrl) {
    location["@id"] = venueUrl;
    location.url = venueUrl;
  }

  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: event.title,
    startDate: event.startTs,
    eventStatus: mapEventStatus(event.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location,
    url: eventUrl,
    description: event.descriptionText?.trim() || buildEventDescription(event, venue)
  };

  if (event.endTs) {
    payload.endDate = event.endTs;
  }

  const image = resolveOgImageUrl(input.heroImageUrl);
  if (image) {
    payload.image = image;
  }

  const offer = buildEventOffer(event, eventUrl);
  if (offer) {
    payload.offers = offer;
  }

  return payload;
}

export function buildVenueJsonLd(
  venue: Pick<Venue, "name" | "address" | "city" | "lat" | "lng" | "slug" | "website" | "description">
): Record<string, unknown> {
  const venueUrl = canonicalUrl(`/venue/${venue.slug}`);
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": venueUrl,
    name: venue.name,
    url: venueUrl,
    address: {
      "@type": "PostalAddress",
      ...(venue.address ? { streetAddress: venue.address } : {}),
      addressLocality: venue.city || "Fresno",
      addressRegion: "CA",
      addressCountry: "US"
    }
  };

  if (venue.lat != null && venue.lng != null) {
    payload.geo = {
      "@type": "GeoCoordinates",
      latitude: venue.lat,
      longitude: venue.lng
    };
  }

  if (venue.website) {
    payload.sameAs = venue.website;
  }

  if (venue.description?.trim()) {
    payload.description = truncateMetaDescription(venue.description);
  }

  return payload;
}

function buildEventOffer(
  event: Pick<Event, "isFree" | "priceMin" | "priceMax" | "currency" | "ticketUrl" | "externalUrl">,
  eventUrl: string
): Record<string, unknown> | null {
  const purchaseUrl = event.ticketUrl ?? event.externalUrl ?? eventUrl;
  if (event.isFree) {
    return {
      "@type": "Offer",
      price: 0,
      priceCurrency: event.currency || "USD",
      availability: "https://schema.org/InStock",
      url: purchaseUrl
    };
  }

  if (event.priceMin == null && event.priceMax == null) {
    return null;
  }

  const price = event.priceMin ?? event.priceMax;
  if (price == null) {
    return null;
  }

  return {
    "@type": "Offer",
    price,
    priceCurrency: event.currency || "USD",
    availability: "https://schema.org/InStock",
    url: purchaseUrl
  };
}

function mapEventStatus(status: EventStatus): string {
  switch (status) {
    case "cancelled":
    case "inferred_cancelled":
      return "https://schema.org/EventCancelled";
    case "postponed":
      return "https://schema.org/EventPostponed";
    default:
      return "https://schema.org/EventScheduled";
  }
}

function formatPacificEventDate(startTs: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: PACIFIC_TZ
  }).format(new Date(startTs));
}

function formatPacificDayTitle(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PACIFIC_TZ
  }).format(new Date(`${isoDate}T12:00:00-07:00`));
}

export function formatCategoryLabel(category: EventCategory): string {
  const labels: Record<EventCategory, string> = {
    music: "Live music",
    comedy: "Comedy",
    food_drink: "Food & drink",
    art: "Arts",
    theater: "Theater",
    sports: "Sports",
    outdoor: "Outdoor",
    family: "Family",
    festival: "Festival",
    community: "Community",
    nightlife: "Nightlife",
    wellness: "Wellness",
    education: "Education"
  };
  return labels[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
