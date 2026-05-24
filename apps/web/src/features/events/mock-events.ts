import type { Event, ImageAsset, Venue } from "@fresno-events/shared";

import type { TodayEventItem } from "./types";

const timeZone = "America/Los_Angeles";

const images = {
  towerGlow: {
    id: "11111111-1111-4111-8111-111111111111",
    storageKey: "mock/tower-art-hop-afterglow.webp",
    cdnUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    blurhash: "LHG]pT~qxaRj-;M{t7t7?bRjM{t7",
    dominantColor: "#c97838",
    altText: "People gathered under warm stage lights at a night market.",
    sourceUrl: "https://unsplash.com/photos/people-watching-concert-44h18J7K7Tg",
    license: "Unsplash",
    createdAt: "2026-04-25T08:00:00.000Z"
  },
  tiogaJazz: {
    id: "22222222-2222-4222-8222-222222222222",
    storageKey: "mock/tioga-jazz-yard.webp",
    cdnUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    dominantColor: "#6e3f2a",
    altText: "A jazz band performs in an intimate venue.",
    sourceUrl: "https://unsplash.com/photos/person-playing-trumpet-LGCd1e_0gEY",
    license: "Unsplash",
    createdAt: "2026-04-25T08:00:00.000Z"
  },
  woodwardMorning: {
    id: "33333333-3333-4333-8333-333333333333",
    storageKey: "mock/woodward-park-morning.webp",
    cdnUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    dominantColor: "#7d8f4d",
    altText: "Families relax in a sunlit park.",
    sourceUrl: "https://unsplash.com/photos/green-trees-near-body-of-water-during-daytime-pHANr-CpbYM",
    license: "Unsplash",
    createdAt: "2026-04-25T08:00:00.000Z"
  },
  ballpark: {
    id: "44444444-4444-4444-8444-444444444444",
    storageKey: "mock/chukchansi-fireworks.webp",
    cdnUrl: "https://images.unsplash.com/photo-1505842465776-3d90f616310d?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    dominantColor: "#375a77",
    altText: "Fireworks light up a stadium at night.",
    sourceUrl: "https://unsplash.com/photos/fireworks-display-H8BRmI9jG9A",
    license: "Unsplash",
    createdAt: "2026-04-25T08:00:00.000Z"
  },
  saroyanStage: {
    id: "55555555-5555-4555-8555-555555555555",
    storageKey: "mock/saroyan-stage.webp",
    cdnUrl: "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    dominantColor: "#7b2935",
    altText: "A theater stage glows before a performance.",
    sourceUrl: "https://unsplash.com/photos/empty-theater-seats-evlkOfkQ5rE",
    license: "Unsplash",
    createdAt: "2026-04-25T08:00:00.000Z"
  }
} satisfies Record<string, ImageAsset>;

const venues = {
  warnors: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "warnors-theatre",
    name: "Warnors Theatre",
    address: "1400 Fulton St",
    city: "Fresno",
    neighborhood: "Downtown",
    lat: 36.7378,
    lng: -119.7927,
    capacity: 2000,
    website: "https://warnorscenter.org",
    socials: {},
    heroImageId: images.towerGlow.id,
    description: "Historic downtown theater anchoring Fulton Street nights.",
    primaryCategory: "art",
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z"
  },
  tioga: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    slug: "tioga-sequoia-beer-garden",
    name: "Tioga-Sequoia Beer Garden",
    address: "745 Fulton St",
    city: "Fresno",
    neighborhood: "Downtown",
    lat: 36.7318,
    lng: -119.7871,
    website: "https://tiogasequoia.com",
    socials: {},
    heroImageId: images.tiogaJazz.id,
    description: "Open-air beer garden with food trucks, DJs, and local music.",
    primaryCategory: "music",
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z"
  },
  woodward: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    slug: "woodward-park",
    name: "Woodward Park",
    address: "7775 N Friant Rd",
    city: "Fresno",
    neighborhood: "North Fresno",
    lat: 36.8721,
    lng: -119.7849,
    capacity: 5000,
    website: "https://www.fresno.gov/parks",
    socials: {},
    heroImageId: images.woodwardMorning.id,
    description: "Regional park with trails, gardens, open lawns, and family events.",
    primaryCategory: "outdoor",
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z"
  },
  chukchansi: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    slug: "chukchansi-park",
    name: "Chukchansi Park",
    address: "1800 Tulare St",
    city: "Fresno",
    neighborhood: "Downtown",
    lat: 36.7328,
    lng: -119.7902,
    capacity: 12500,
    website: "https://www.milb.com/fresno",
    socials: {},
    heroImageId: images.ballpark.id,
    description: "Downtown ballpark and summer gathering place.",
    primaryCategory: "sports",
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z"
  },
  saroyan: {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    slug: "saroyan-theatre",
    name: "Saroyan Theatre",
    address: "730 M St",
    city: "Fresno",
    neighborhood: "Downtown",
    lat: 36.7347,
    lng: -119.7847,
    capacity: 2353,
    website: "https://saroyantheatre.com",
    socials: {},
    heroImageId: images.saroyanStage.id,
    description: "Performing arts theater for concerts, Broadway tours, and symphony nights.",
    primaryCategory: "theater",
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z"
  }
} satisfies Record<string, Venue>;

export function getMockTodayEvents(): TodayEventItem[] {
  const now = new Date();
  const today = atLocalTime(now, 18, 30);
  const tonight = atLocalTime(now, 20, 0);
  const tomorrow = addDays(atLocalTime(now, 10, 0), 1);
  const tomorrowNight = addDays(atLocalTime(now, 19, 5), 1);
  const nextDay = addDays(atLocalTime(now, 19, 30), 2);

  return [
    createItem({
      event: createEvent({
        id: "f1000000-0000-4000-8000-000000000001",
        slug: "tower-art-hop-afterglow",
        title: "Tower Art Hop Afterglow",
        descriptionText: "Gallery pop-ups, vinyl selectors, and late-night bites along Fulton after the first wave of ArtHop.",
        venue: venues.warnors,
        heroImage: images.towerGlow,
        startTs: today,
        endTs: addHours(today, 4),
        category: "art",
        tags: ["gallery", "night market", "downtown"],
        priceMin: 0,
        priceMax: 18,
        isFree: true,
        ticketUrl: "https://example.com/events/tower-art-hop-afterglow",
        priority: 0
      }),
      venue: venues.warnors,
      heroImage: images.towerGlow,
      accent: "sunset",
      kicker: "Editor's pick",
      priceLabel: "Free entry",
      saveCount: 284,
      featured: true
    }),
    createItem({
      event: createEvent({
        id: "f1000000-0000-4000-8000-000000000002",
        slug: "tioga-sequoia-rooftop-jazz",
        title: "Rooftop Jazz at Tioga-Sequoia",
        descriptionText: "A brass-heavy local trio takes over the beer garden with rotating food trucks and a sunset DJ set.",
        venue: venues.tioga,
        heroImage: images.tiogaJazz,
        startTs: tonight,
        endTs: addHours(tonight, 3),
        category: "music",
        subcategories: ["jazz", "local"],
        tags: ["live music", "beer garden", "food trucks"],
        priceMin: 12,
        priceMax: 20,
        ticketUrl: "https://example.com/events/tioga-sequoia-rooftop-jazz",
        priority: 1
      }),
      venue: venues.tioga,
      heroImage: images.tiogaJazz,
      accent: "fig",
      kicker: "Tonight",
      priceLabel: "$12-20",
      saveCount: 198
    }),
    createItem({
      event: createEvent({
        id: "f1000000-0000-4000-8000-000000000003",
        slug: "woodward-family-kite-morning",
        title: "Family Kite Morning",
        descriptionText: "Pack a blanket for kite demos, lawn games, kid crafts, and coffee carts near the Shinzen Garden entrance.",
        venue: venues.woodward,
        heroImage: images.woodwardMorning,
        startTs: tomorrow,
        endTs: addHours(tomorrow, 3),
        category: "family",
        tags: ["kids", "outdoor", "free"],
        priceMin: 0,
        priceMax: 0,
        isFree: true
      }),
      venue: venues.woodward,
      heroImage: images.woodwardMorning,
      accent: "olive",
      kicker: "Family-friendly",
      priceLabel: "Free",
      saveCount: 142
    }),
    createItem({
      event: createEvent({
        id: "f1000000-0000-4000-8000-000000000004",
        slug: "grizzlies-fireworks-night",
        title: "Grizzlies Fireworks Night",
        descriptionText: "A home-stand night downtown with post-game fireworks, local vendors, and family sections behind first base.",
        venue: venues.chukchansi,
        heroImage: images.ballpark,
        startTs: tomorrowNight,
        endTs: addHours(tomorrowNight, 3),
        category: "sports",
        tags: ["baseball", "fireworks", "downtown"],
        priceMin: 15,
        priceMax: 42,
        ticketUrl: "https://example.com/events/grizzlies-fireworks-night"
      }),
      venue: venues.chukchansi,
      heroImage: images.ballpark,
      accent: "sky",
      kicker: "Weekend energy",
      priceLabel: "$15-42",
      saveCount: 356
    }),
    createItem({
      event: createEvent({
        id: "f1000000-0000-4000-8000-000000000005",
        slug: "saroyan-symphony-cinema-night",
        title: "Symphony Cinema Night",
        descriptionText: "A film-score program with Fresno Philharmonic musicians and a lobby tasting from Central Valley makers.",
        venue: venues.saroyan,
        heroImage: images.saroyanStage,
        startTs: nextDay,
        endTs: addHours(nextDay, 2),
        category: "theater",
        subcategories: ["symphony", "film"],
        tags: ["date night", "arts", "downtown"],
        priceMin: 28,
        priceMax: 76,
        ticketUrl: "https://example.com/events/saroyan-symphony-cinema-night"
      }),
      venue: venues.saroyan,
      heroImage: images.saroyanStage,
      accent: "rose",
      kicker: "New this week",
      priceLabel: "$28-76",
      saveCount: 119
    })
  ];
}

export function getMockEventBySlug(slug: string) {
  return getMockTodayEvents().find((item) => item.event.slug === slug) ?? null;
}

function createEvent(input: {
  id: string;
  slug: string;
  title: string;
  descriptionText: string;
  venue: Venue;
  heroImage: ImageAsset;
  startTs: Date;
  endTs: Date;
  category: Event["category"];
  subcategories?: string[];
  tags: string[];
  priceMin: number;
  priceMax: number;
  isFree?: boolean;
  ticketUrl?: string;
  priority?: number;
}): Event {
  const createdAt = "2026-04-25T08:00:00.000Z";
  return {
    id: input.id,
    slug: input.slug,
    source: "manual",
    sourceEventId: input.slug,
    sourceRefs: { mock: input.slug },
    title: input.title,
    descriptionText: input.descriptionText,
    venueId: input.venue.id,
    startTs: input.startTs.toISOString(),
    endTs: input.endTs.toISOString(),
    timezone: timeZone,
    category: input.category,
    subcategories: input.subcategories ?? [],
    tags: input.tags,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    currency: "USD",
    isFree: input.isFree ?? false,
    status: "scheduled",
    heroImageId: input.heroImage.id,
    galleryImageIds: [input.heroImage.id],
    allArtistIds: [],
    priority: input.priority ?? 5,
    createdAt,
    updatedAt: createdAt,
    ...(input.ticketUrl ? { ticketUrl: input.ticketUrl, externalUrl: input.ticketUrl } : {})
  };
}

function createItem(input: {
  event: Event;
  venue: Venue;
  heroImage: ImageAsset;
  accent: TodayEventItem["accent"];
  kicker: string;
  priceLabel: string;
  saveCount: number;
  featured?: boolean;
}): TodayEventItem {
  return {
    event: input.event,
    venue: input.venue,
    heroImage: input.heroImage,
    accent: input.accent,
    kicker: input.kicker,
    neighborhood: input.venue.neighborhood ?? input.venue.city,
    priceLabel: input.priceLabel,
    timeLabel: formatTime(input.event.startTs),
    dateLabel: formatDate(input.event.startTs),
    saveCount: input.saveCount,
    ...(input.featured ? { featured: true } : {})
  };
}

function atLocalTime(base: Date, hour: number, minute: number) {
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(base: Date, hours: number) {
  const date = new Date(base);
  date.setHours(date.getHours() + hours);
  return date;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone
  }).format(new Date(value));
}
