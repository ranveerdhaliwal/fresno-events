import type { EventDetailResponse, VenueDetailResponse } from "@fresno-events/shared";
import {
  buildBreadcrumbJsonLd,
  buildCalendarDescription,
  buildCalendarTitle,
  buildDayDescription,
  buildDayTitle,
  buildEventDescription,
  buildEventJsonLd,
  buildEventTitle,
  buildHomeDescription,
  buildHomeTitle,
  buildVenueDescription,
  buildVenueJsonLd,
  buildVenueTitle,
  buildWebsiteJsonLd,
  SITE_NAME,
  truncateMetaDescription,
  type SeoHeadInput
} from "@fresno-events/shared";

export function buildHomeSeo(): SeoHeadInput {
  return {
    title: buildHomeTitle(),
    description: buildHomeDescription(),
    canonicalPath: "/",
    ogType: "website",
    jsonLd: buildWebsiteJsonLd()
  };
}

export function buildEventSeo(detail: EventDetailResponse, dayIso: string): SeoHeadInput {
  const { event, venue, heroImage } = detail;
  return {
    title: buildEventTitle(event, venue),
    description: buildEventDescription(event, venue),
    canonicalPath: `/event/${event.slug}`,
    ogImageUrl: heroImage?.cdnUrl ?? null,
    ogType: "website",
    jsonLd: [
      buildEventJsonLd({
        event,
        venue,
        heroImageUrl: heroImage?.cdnUrl ?? null
      }),
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: dayIso, path: `/day/${dayIso}` },
        { name: event.title, path: `/event/${event.slug}` }
      ])
    ]
  };
}

export function buildVenueSeo(detail: VenueDetailResponse): SeoHeadInput {
  const upcomingCount = detail.upcomingEvents.length;
  return {
    title: buildVenueTitle(detail.venue),
    description: buildVenueDescription(detail.venue, upcomingCount),
    canonicalPath: `/venue/${detail.venue.slug}`,
    ogType: "website",
    noindex: upcomingCount === 0,
    jsonLd: buildVenueJsonLd(detail.venue)
  };
}

export function buildDaySeo(isoDate: string, eventCount: number): SeoHeadInput {
  return {
    title: buildDayTitle(isoDate),
    description: buildDayDescription(isoDate, eventCount),
    canonicalPath: `/day/${isoDate}`,
    ogType: "website"
  };
}

export function buildCalendarSeo(year: number, month: number): SeoHeadInput {
  return {
    title: buildCalendarTitle(year, month),
    description: buildCalendarDescription(year, month),
    canonicalPath: "/calendar",
    ogType: "website"
  };
}

export function buildAdminSeo(): SeoHeadInput {
  return {
    title: `Admin · ${SITE_NAME}`,
    description: "Admin review workspace.",
    canonicalPath: "/admin",
    noindex: true
  };
}

export function buildNoIndexSeo(title: string, description: string, canonicalPath: string): SeoHeadInput {
  return {
    title,
    description: truncateMetaDescription(description),
    canonicalPath,
    noindex: true
  };
}

export function buildSearchSeo(query: string): SeoHeadInput {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return buildNoIndexSeo(`Search · ${SITE_NAME}`, "Search events, venues, and artists in Fresno.", "/search");
  }
  return {
    title: `Search: ${trimmed} · ${SITE_NAME}`,
    description: truncateMetaDescription(`Search results for "${trimmed}" in Fresno and the Central Valley.`),
    canonicalPath: `/search?q=${encodeURIComponent(trimmed)}`,
    ogType: "website"
  };
}

export function buildPrivacySeo(): SeoHeadInput {
  return {
    title: `Privacy Policy · ${SITE_NAME}`,
    description: truncateMetaDescription("Privacy policy for What Up Fresno."),
    canonicalPath: "/privacy",
    ogType: "website"
  };
}

export function buildMapSeo(): SeoHeadInput {
  return {
    title: `Event map · ${SITE_NAME}`,
    description: truncateMetaDescription("Explore Fresno events on the map."),
    canonicalPath: "/map",
    ogType: "website"
  };
}
