import type { Event, ImageAsset, NormalizedEvent, Venue } from "@fresno-events/shared";

export function publishedEventToNormalized(
  event: Event,
  venue: Venue,
  heroImage?: ImageAsset
): NormalizedEvent {
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
  if (venue.lat !== undefined) {
    normalized.venueLat = venue.lat;
  }
  if (venue.lng !== undefined) {
    normalized.venueLng = venue.lng;
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
  if (event.isFree === true || (event.priceMin === 0 && event.priceMax === 0)) {
    normalized.isFree = true;
  }
  if (heroImage?.cdnUrl) {
    normalized.imageUrl = heroImage.cdnUrl;
  }
  if (event.mapPinEmoji != null) {
    normalized.mapPinEmoji = event.mapPinEmoji;
  }

  return normalized;
}
