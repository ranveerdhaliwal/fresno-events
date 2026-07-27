// Type-only modules (domain, ingest pipeline, review queue, API contract).
export * from "./event.types.js";
export * from "./ingest.types.js";
export * from "./review.types.js";
export * from "./api.types.js";

export type { LineupEntry } from "./lineup.js";
export { LineupEntrySchema, LineupSchema, parseLineup } from "./lineup.js";
export {
  computeOccurrenceFingerprints,
  computeOccurrenceKey,
  computeDateOnlyOccurrenceKey,
  computeLooseOccurrenceKey,
  computeUrlKey,
  normalizeTitle,
  normalizeVenue,
  canonicalOccurrenceTitle,
  isUtcNoonAllDaySentinel,
  pacificDateFromStartTs,
  normalizeListingUrl,
  isUniquePerPerformanceListingUrl,
  normalizedListingUrlForEvent,
  listingUrlsReferToSamePerformance,
  pacificTimeBucketKey,
  sourcePriorityRank,
  sha256Hex,
  type OccurrenceFingerprints
} from "./occurrence.js";
export {
  formatTitleSimilarityLabel,
  isNearCrossSourceTitleMatch,
  isStrongCrossSourceTitleMatch,
  sameNormalizedVenue,
  samePacificShowDate,
  scoreTitleSimilarity,
  significantTitleTokens,
  startTsLookupWindow,
  venueDateLookupKey,
  type TitleSimilarityScore
} from "./title-similarity.utils.js";
export {
  applyDisplayPriceRounding,
  roundDisplayPriceUp
} from "./price-display.utils.js";
export {
  isRecurringSeries,
  venueScope,
  listingUrlSeriesAnchor,
  computeAdHocSeriesId,
  computeCanonicalSeriesId,
  type SeriesResolveInput,
  type SeriesResolveResult
} from "./series.js";
export {
  clampEventPriority,
  clampSuggestedPriorityForOrganicEvent,
  EVENT_DISPLAY_PRIORITY,
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY,
  formatEventDisplayPriorityRubric,
  getEventDisplayPriorityLabel,
  type EventDisplayPriorityTier
} from "./priority.js";
export {
  suggestEventPriority,
  type PriorityRuleInput,
  type PrioritySuggestion,
  type PriorityRuleKind
} from "./priority-rules.js";
export {
  formatIngestExclusionNotes,
  getIngestExclusion,
  isGobulldogsAwayGame,
  type IngestExclusion,
  type IngestExclusionInput
} from "./ingest-exclusions.js";
export {
  compareEventsByPriorityStart,
  selectEventPreview,
  type EventPreviewSortable,
  type PreviewCaps
} from "./event-preview.js";
export {
  dedupeEventsByContent,
  dedupeEventsByListingGroup,
  diversifyHomepageFeatured,
  eventContentSignature,
  eventListingGroupKey,
  isSportsEvent,
  type EventContentSignatureInput,
  type EventListingGroupInput
} from "./event-dedupe.js";
export {
  groupPublishedEventsByContent,
  pickCanonicalPublishedEvent,
  planPublishedOrphanDeletions,
  type PublishedEventAuditRow,
  type PublishedOrphanDeletion
} from "./published-event-dedupe.utils.js";
export {
  PACIFIC_TZ,
  addDaysToIsoDate,
  daysFromIsoThroughSunday,
  nextSaturdayIso,
  pacificEndOfDay,
  pacificMonthBounds,
  pacificStartOfDay,
  pacificTodayIso,
  buildNextPacificMonths,
  isoDateInPacificMonth,
  resolvePacificDateWindow,
  upcomingSundayIso,
  type DateWindowPreset,
  type PacificDateRange,
  type PacificMonthTile
} from "./pacific-date-ranges.js";
export { DEFAULT_EVENT_DURATION_MS, resolveEndTs } from "./default-end-ts.js";
export {
  MAP_PIN_EMOJI_PRESETS,
  resolveMapPinEmoji,
  type MapPinEmojiInput
} from "./map-pin-emoji.js";
export { airQualityIconFor } from "./air-quality-icon.js";
export {
  decodeHtmlEntities,
  sanitizeIngestDescriptionText,
  stripBracketedLinkPlaceholders
} from "./description-text.utils.js";
export { sanitizeEventTags } from "./event-tags.utils.js";
export {
  buildBreadcrumbJsonLd,
  buildCalendarDescription,
  buildCalendarTitle,
  buildDayDescription,
  buildDayTitle,
  buildEventDescription,
  buildEventIntroSentence,
  buildEventJsonLd,
  buildEventTitle,
  buildHomeDescription,
  buildHomeTitle,
  buildOgTags,
  buildRobotsContent,
  buildTwitterTags,
  buildVenueDescription,
  buildVenueJsonLd,
  buildVenueTitle,
  buildWebsiteJsonLd,
  canonicalUrl,
  defaultOgImageUrl,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_DESCRIPTION,
  formatCategoryLabel,
  resolveOgImageUrl,
  SITE_NAME,
  SITE_ORIGIN,
  truncateMetaDescription,
  type OgTagSet,
  type SeoHeadInput,
  type TwitterTagSet
} from "./seo/seo.utils.js";
export {
  buildGoogleMapsSearchUrl,
  buildMapsSearchQuery,
  isValidCoordinate,
  normalizeVenueStreetAddress,
  parseMailingAddress,
  parseStreetFromFullAddress,
  resolveVenueLocationFields,
  type MapsLinkInput,
  type ResolvedVenueLocation,
  type VenueLocationParts
} from "./venue-location.utils.js";
export type {
  ReviewOccurrenceRelinkLinkExample,
  ReviewOccurrenceRelinkOpsResponse,
  ReviewOccurrenceRelinkSummary,
  ReviewPriorityRerankOpsResponse,
  ReviewPriorityRerankRuleGroup,
  ReviewPriorityRerankSection,
  ReviewPriorityRerankSectionSummary,
  ReviewPriorityTriageOpsResponse,
  ReviewPriorityTriageRuleGroup,
  ReviewPriorityTriageSummary,
  ReviewPublishedOrphanOpsResponse,
  ReviewPublishedOrphanSummary,
  ReviewPublishedOrphanDeletion,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueAddressBackfillSummary,
  ReviewVenueGeocodeOpsResponse,
  ReviewVenueGeocodeSummary
} from "./review-ops.types.js";
