/**
 * Deterministic display-priority rules (no LLM). Single source of truth for:
 *  - ingest enrichment venue/source override (workers/ingest)
 *  - admin priority rerank ops (apps/api)
 *  - retroactive rerank script (scripts/priority-rerank.mjs)
 *
 * Lower priority number = more prominent in the feed (see EVENT_DISPLAY_PRIORITY).
 * Rules layer by precedence: editorial (named draws) > recurring (routine listings) > venue/source default.
 * First match wins; returns null when no rule applies (caller falls back to AI / default P5).
 */

export type PriorityRuleKind = "editorial" | "recurring" | "venue";

export interface PriorityRuleInput {
  /** EventSource string (e.g. "ticketmaster", "scrape:fulton55.com", "api:milb"). */
  source: string;
  title: string;
  venueName: string;
}

export interface PrioritySuggestion {
  priority: number;
  ruleId: string;
  ruleLabel: string;
  kind: PriorityRuleKind;
}

interface RuleContext {
  source: string;
  title: string;
  venueName: string;
  /** Lowercased title — recurring keywords describe the event, so match here (not the venue). */
  titleLower: string;
  /** Lowercased "title venueName" — only for rules that intentionally consider the venue. */
  blob: string;
}

interface KeywordRule {
  id: string;
  label: string;
  priority: number;
  kind: PriorityRuleKind;
  match: (ctx: RuleContext) => boolean;
}

interface VenueRule {
  id: string;
  label: string;
  priority: number;
  /** Exact EventSource match (optional). */
  source?: string;
  /** Case-insensitive substring on venueName (optional). */
  venueNameIncludes?: string;
}

function buildContext(input: PriorityRuleInput): RuleContext {
  const title = input.title ?? "";
  const venueName = input.venueName ?? "";
  return {
    source: input.source ?? "",
    title,
    venueName,
    titleLower: title.toLowerCase(),
    blob: `${title} ${venueName}`.toLowerCase()
  };
}

/** Grizzlies home games are at Chukchansi Park; the api:milb feed is all Grizzlies. */
function isFresnoGrizzliesHome(ctx: RuleContext): boolean {
  return ctx.source === "api:milb" || /chukchansi/.test(ctx.venueName.toLowerCase());
}

function isAwayMinorLeagueBaseball(ctx: RuleContext): boolean {
  if (!/\bvs\.?\b/.test(ctx.title)) {
    return false;
  }
  if (isFresnoGrizzliesHome(ctx)) {
    return false;
  }
  return (
    /rawhide|stockton ports|san jose giants|modesto nuts|inland empire|lake elsinore|rancho cucamonga|visalia/.test(
      ctx.blob
    ) || (ctx.source === "ticketmaster" && /ballpark|stadium/.test(ctx.blob))
  );
}

function isBigFresnoFairVenue(ctx: RuleContext): boolean {
  return /big fresno fair/i.test(ctx.venueName);
}

/** National / arena-scale headliners → P2 at any venue (fair, Save Mart, etc.). */
const MAJOR_HEADLINER_PATTERN =
  /\b(ashanti|soul for real|nate bargatze|weird al|yankovic|jamie foxx|gabriel iglesias|jason aldean|lil wayne|gene simmons|pepe aguilar|grupo frontera|zz top|los lobos|brit floyd|jason bonham|fey)\b/i;

function isMajorHeadliner(ctx: RuleContext): boolean {
  return MAJOR_HEADLINER_PATTERN.test(ctx.title);
}

/**
 * Named marquee/notable draws. These can promote (P1/P2) and win over venue defaults
 * so a big show at a mid venue still ranks correctly.
 */
const EDITORIAL_RULES: readonly KeywordRule[] = [
  {
    id: "ringling-circus",
    label: "Ringling / Barnum circus (arena draw)",
    priority: 1,
    kind: "editorial",
    match: (ctx) => /ringling|barnum\s*&?\s*bailey|greatest show on earth/i.test(ctx.title)
  },
  {
    id: "monster-jam-arena",
    label: "Monster Jam @ arena",
    priority: 1,
    kind: "editorial",
    match: (ctx) => /\bmonster jam\b/i.test(ctx.title) && /save mart|chukchansi/i.test(ctx.venueName)
  },
  {
    id: "major-headliner",
    label: "Major national headliner",
    priority: 2,
    kind: "editorial",
    match: isMajorHeadliner
  },
  {
    id: "miss-california-pageant",
    label: "Miss California pageant",
    priority: 2,
    kind: "editorial",
    match: (ctx) => /\bmiss california\b/i.test(ctx.title)
  },
  {
    id: "fifa-world-cup-watch",
    label: "FIFA World Cup watch party",
    priority: 3,
    kind: "editorial",
    match: (ctx) => /\bfifa\b.*\bworld cup\b|\bworld cup\b.*\bwatch\b/i.test(ctx.titleLower)
  }
];

/**
 * Routine / recurring community listings. These demote (P4/P5) and win over venue defaults
 * so a farmers market in an arena parking lot does not inherit the arena's prominence.
 */
const RECURRING_RULES: readonly KeywordRule[] = [
  {
    id: "fair-flea-market",
    label: "Big Fresno Fair flea market",
    priority: 4,
    kind: "recurring",
    match: (ctx) => /\bflea market\b/.test(ctx.titleLower) && isBigFresnoFairVenue(ctx)
  },
  {
    id: "fair-routine-program",
    label: "Big Fresno Fair routine program day",
    priority: 4,
    kind: "recurring",
    match: (ctx) => {
      if (!isBigFresnoFairVenue(ctx)) {
        return false;
      }
      return /\b(seniors?'?\s*day|big band review|car show|4\.0\s*&\s*above|day\s*&\s*expo)\b/i.test(ctx.titleLower);
    }
  },
  {
    id: "downtown-market",
    label: "Downtown / street market (recurring)",
    priority: 4,
    kind: "recurring",
    match: (ctx) => /\bthe market on\b|\bfresno street eats\b/i.test(ctx.titleLower)
  },
  {
    id: "farmers-market",
    label: "Farmers market (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bfarmer'?s?\s*market\b/.test(ctx.titleLower)
  },
  {
    id: "flea-market",
    label: "Flea market (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bflea market\b/.test(ctx.titleLower)
  },
  {
    id: "big-fresno-fair-routine",
    label: "Big Fresno Fair routine / grounds listing",
    priority: 4,
    kind: "recurring",
    match: (ctx) => isBigFresnoFairVenue(ctx) && /museum|flea market|farmer'?s?\s*market/.test(ctx.titleLower)
  },
  {
    id: "karaoke-night",
    label: "Karaoke night (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bkaraoke\b/.test(ctx.titleLower)
  },
  {
    id: "trivia-night",
    label: "Trivia night (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\btrivia\b/.test(ctx.titleLower)
  },
  {
    id: "open-mic",
    label: "Open mic (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bopen mic\b/.test(ctx.titleLower)
  },
  {
    id: "bingo-night",
    label: "Bingo (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bbingo\b/.test(ctx.titleLower)
  },
  {
    id: "scavenger-hunt",
    label: "Scavenger hunt (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bscavenger hunt\b/.test(ctx.titleLower)
  },
  {
    id: "wine-walk-down",
    label: "Wine walk / wine down (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\bwine (walk|down|tasting)\b/.test(ctx.titleLower)
  },
  {
    id: "fitness-class",
    label: "Fitness class (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\b(yoga|barre|zumba|pilates|spin class|boot ?camp|high fitness)\b/.test(ctx.titleLower)
  },
  {
    id: "kids-storytime",
    label: "Story time / kids club (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\b(story ?time|kids club|family fridays|toddler time)\b/.test(ctx.titleLower)
  },
  {
    id: "meetup-networking",
    label: "Meetup / networking (recurring)",
    priority: 5,
    kind: "recurring",
    match: (ctx) => /\b(speed dating|meet ?up|networking|mixer)\b/.test(ctx.titleLower)
  },
  {
    id: "workshop-class-clinic-camp",
    label: "Workshop / class / clinic / camp",
    priority: 5,
    kind: "recurring",
    match: (ctx) =>
      /\b(workshop|clinic|\bcamp\b|class series|professional development|civic academy|leadership program)\b/.test(
        ctx.titleLower
      )
  },
  {
    id: "graduation-commencement",
    label: "Graduation / ceremony (venue rental)",
    priority: 5,
    kind: "recurring",
    match: (ctx) =>
      /\b(graduation|graduations|commencement|baccalaureate)\b/.test(ctx.titleLower) ||
      /\b(recognition|honors?|awards?) ceremon/.test(ctx.titleLower)
  },
  {
    id: "film-screening",
    label: "Film / movie screening",
    priority: 4,
    kind: "recurring",
    match: (ctx) => /\b(film|movie) screening|cinema night\b/.test(ctx.titleLower)
  },
  {
    id: "lds-ward-activity",
    label: "LDS / ward community activity",
    priority: 5,
    kind: "recurring",
    match: (ctx) =>
      /church of jesus christ|single adult potluck|ysa fhe|english connect|ward youth activity|friday night ysa sports/.test(
        ctx.blob
      )
  },
  {
    id: "away-minor-league",
    label: "Away / non-Grizzlies minor-league baseball",
    priority: 5,
    kind: "recurring",
    match: isAwayMinorLeagueBaseball
  },
  {
    id: "run-walk",
    label: "Community run / walk",
    priority: 4,
    kind: "recurring",
    match: (ctx) =>
      /\b(fun run|color run|freedom run|father'?s day run|turkey trot|run\s*\/\s*walk|\d{1,3}k\b|half[- ]?marathon|marathon)\b/.test(
        ctx.titleLower
      )
  }
];

/**
 * Venue / source defaults. Provide a sensible baseline prominence for known venues so
 * events neither over- nor under-rank when the AI is unsure. First match wins.
 */
const VENUE_RULES: readonly VenueRule[] = [
  { id: "save-mart-center", label: "Save Mart Center (arena)", priority: 2, source: "scrape:www.savemartcenter.com" },
  { id: "save-mart-center-venue", label: "Save Mart Center (arena)", priority: 2, venueNameIncludes: "save mart center" },
  { id: "big-fresno-fair", label: "Big Fresno Fair", priority: 3, source: "scrape:www.fresnofair.com" },
  {
    id: "fresno-convention-center",
    label: "Fresno Convention Center",
    priority: 3,
    source: "scrape:events.fresnoconventioncenter.com"
  },
  { id: "saroyan-selland", label: "Saroyan / Selland Arena", priority: 3, venueNameIncludes: "saroyan" },
  { id: "selland-arena", label: "Selland Arena", priority: 3, venueNameIncludes: "selland" },
  { id: "tower-theatre-src", label: "Tower Theatre", priority: 3, source: "scrape:towertheatre.ticketsauce.com" },
  { id: "tower-theatre-venue", label: "Tower Theatre", priority: 3, venueNameIncludes: "tower theatre" },
  { id: "warnors", label: "Warnors Theatre", priority: 3, venueNameIncludes: "warnors" },
  { id: "milb", label: "Grizzlies / MiLB", priority: 3, source: "api:milb" },
  { id: "grizzlies-park", label: "Grizzlies ballpark", priority: 3, venueNameIncludes: "chukchansi park" },
  { id: "fulton55-src", label: "Fulton 55", priority: 4, source: "scrape:fulton55.com" },
  { id: "fulton55-venue", label: "Fulton 55", priority: 4, venueNameIncludes: "fulton 55" },
  { id: "strummers-src", label: "Strummer's", priority: 4, source: "scrape:strummersclub.com" },
  { id: "strummers-venue", label: "Strummer's", priority: 4, venueNameIncludes: "strummer" },
  { id: "rainbow-ballroom-src", label: "Rainbow Ballroom", priority: 4, source: "scrape:rainbowballroom.com" },
  { id: "rainbow-ballroom-venue", label: "Rainbow Ballroom", priority: 4, venueNameIncludes: "rainbow ballroom" },
  { id: "chaffee-zoo", label: "Fresno Chaffee Zoo", priority: 4, source: "scrape:fcz.org" }
];

function matchVenueRule(ctx: RuleContext): VenueRule | null {
  const venueLower = ctx.venueName.toLowerCase();
  for (const rule of VENUE_RULES) {
    if (rule.source && ctx.source !== rule.source) {
      continue;
    }
    if (rule.venueNameIncludes && !venueLower.includes(rule.venueNameIncludes)) {
      continue;
    }
    if (!rule.source && !rule.venueNameIncludes) {
      continue;
    }
    return rule;
  }
  return null;
}

/** Resolve a deterministic priority suggestion, or null when no rule applies. */
export function suggestEventPriority(input: PriorityRuleInput): PrioritySuggestion | null {
  const ctx = buildContext(input);

  // Fresno State athletics has its own dynamic priority logic (workers/ingest); never
  // let generic venue/title rules override it (e.g. a volleyball scrimmage at Save Mart Center).
  if (ctx.source === "api:gobulldogs") {
    return null;
  }

  for (const rule of EDITORIAL_RULES) {
    if (rule.match(ctx)) {
      return { priority: rule.priority, ruleId: rule.id, ruleLabel: rule.label, kind: rule.kind };
    }
  }

  for (const rule of RECURRING_RULES) {
    if (rule.match(ctx)) {
      return { priority: rule.priority, ruleId: rule.id, ruleLabel: rule.label, kind: rule.kind };
    }
  }

  const venue = matchVenueRule(ctx);
  if (venue) {
    return { priority: venue.priority, ruleId: venue.id, ruleLabel: venue.label, kind: "venue" };
  }

  return null;
}
