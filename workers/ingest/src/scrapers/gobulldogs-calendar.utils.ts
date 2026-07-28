import type { NormalizedEvent } from "@fresno-events/shared";

import { withDefaultImageUrl } from "@/lib/default-image.utils";
import { dateOnlyStartTs, instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import { isGobulldogsFinalEvent, isGobulldogsFootball } from "@/scrapers/gobulldogs-priority.utils";

const BASE = "https://gobulldogs.com";
const SOURCE = "api:gobulldogs";

export const BULLDOGS_DEFAULT_IMAGE_URL = "https://gobulldogs.com/images/logos/site/site.png";

/** Season-wide series for Fresno State football home games. */
export const GOBULLDOGS_FOOTBALL_SERIES_ID = "series:gobulldogs-football:2026";
export const GOBULLDOGS_FOOTBALL_SERIES_NAME = "Fresno State Football 2026";

export function buildGobulldogsCalendarApiUrl(now: Date, horizonDays = 90): string {
  const end = new Date(now.getTime() + horizonDays * 86_400_000);
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return `${BASE}/api/v2/Calendar/from/${fmt(now)}/to/${fmt(end)}`;
}

type GobulldogsSport = {
  title: string;
  globalSportShortname: string;
};

type GobulldogsOpponent = {
  title: string;
  tournamentTitle: string | null;
};

type GobulldogsFacility = {
  title: string;
};

export type GobulldogsCalendarGame = {
  id: number;
  time: string;
  atVs: string;
  location: string;
  dateUtc: string | null;
  tbd: boolean;
  gameCalendarExclude: boolean;
  gamePromotionText: string | null;
  conferenceTitle: string | null;
  gameImageUrl: string | null;
  sport: GobulldogsSport;
  opponent: GobulldogsOpponent;
  facility: GobulldogsFacility | null;
};

export type GobulldogsCalendarDay = {
  date: string;
  events: GobulldogsCalendarGame[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSport(value: unknown): GobulldogsSport | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const globalSportShortname =
    typeof value.globalSportShortname === "string" ? value.globalSportShortname.trim() : "";
  if (!title || !globalSportShortname) {
    return null;
  }
  return { title, globalSportShortname };
}

function parseOpponent(value: unknown): GobulldogsOpponent | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) {
    return null;
  }
  const tournamentTitle =
    typeof value.tournamentTitle === "string" && value.tournamentTitle.trim()
      ? value.tournamentTitle.trim()
      : null;
  return { title, tournamentTitle };
}

function parseFacility(value: unknown): GobulldogsFacility | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = typeof value.title === "string" ? value.title.trim() : "";
  return title ? { title } : null;
}

function resolveSidearmImageUrl(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("http")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `${BASE}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function parseGame(value: unknown): GobulldogsCalendarGame | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "number" ? value.id : null;
  const sport = parseSport(value.sport);
  const opponent = parseOpponent(value.opponent);
  if (id === null || !sport || !opponent) {
    return null;
  }

  const gamePromotionText =
    typeof value.gamePromotionText === "string" && value.gamePromotionText.trim()
      ? value.gamePromotionText.trim()
      : null;
  const conferenceTitle =
    typeof value.conferenceTitle === "string" && value.conferenceTitle.trim()
      ? value.conferenceTitle.trim()
      : null;

  return {
    id,
    time: typeof value.time === "string" ? value.time.trim() : "",
    atVs: typeof value.atVs === "string" ? value.atVs.trim() : "vs",
    location: typeof value.location === "string" ? value.location.trim() : "",
    dateUtc: typeof value.dateUtc === "string" ? value.dateUtc : null,
    tbd: value.tbd === true,
    gameCalendarExclude: value.gameCalendarExclude === true,
    gamePromotionText,
    conferenceTitle,
    gameImageUrl: resolveSidearmImageUrl(
      typeof value.gameImageUrl === "string" ? value.gameImageUrl : null
    ) ?? null,
    sport,
    opponent,
    facility: parseFacility(value.facility)
  };
}

function parseDay(value: unknown): GobulldogsCalendarDay | null {
  if (!isRecord(value)) {
    return null;
  }
  const date = typeof value.date === "string" ? value.date : "";
  if (!date) {
    return null;
  }

  const rawEvents = Array.isArray(value.events) ? value.events : [];
  const events: GobulldogsCalendarGame[] = [];
  for (const raw of rawEvents) {
    const game = parseGame(raw);
    if (game && !game.gameCalendarExclude) {
      events.push(game);
    }
  }

  return { date, events };
}

export function parseGobulldogsCalendarDays(json: unknown): GobulldogsCalendarDay[] {
  if (!Array.isArray(json)) {
    return [];
  }

  const days: GobulldogsCalendarDay[] = [];
  for (const raw of json) {
    const day = parseDay(raw);
    if (day) {
      days.push(day);
    }
  }
  return days;
}

function opponentTitleHasMatchupLabel(title: string): boolean {
  return /scrimmage/i.test(title) || /\bvs\.?\b/i.test(title);
}

export function buildGobulldogsGameTitle(game: GobulldogsCalendarGame): string {
  const { sport, opponent, atVs } = game;
  const opponentName = opponent.title.trim();

  // Sidearm puts invitational doubleheaders and scrimmages in opponent.title
  // (e.g. "UC Irvine vs. New Mexico State") — don't prepend another "vs".
  if (opponentTitleHasMatchupLabel(opponentName)) {
    return `${sport.title}: ${opponentName}`;
  }

  const prefix = atVs.toLowerCase() === "at" ? "at" : "vs";
  return `${sport.title} ${prefix} ${opponentName}`;
}

function buildGobulldogsDescription(game: GobulldogsCalendarGame): string | undefined {
  const parts: string[] = [];
  const opponentName = game.opponent.title.trim();

  if (game.opponent.tournamentTitle) {
    parts.push(game.opponent.tournamentTitle);
  }
  if (game.conferenceTitle) {
    parts.push(game.conferenceTitle);
  }
  if (game.gamePromotionText) {
    parts.push(game.gamePromotionText);
  }

  if (!opponentTitleHasMatchupLabel(opponentName)) {
    const homeAway = game.atVs.toLowerCase() === "at" ? "at" : "vs";
    parts.push(`${homeAway} ${opponentName}`);
  }

  if (game.facility?.title) {
    parts.push(game.facility.title);
  }
  if (game.location) {
    parts.push(game.location);
  }

  const timeIsUnset = game.tbd || /^tb[ad]$/i.test(game.time);
  const timeLabel = game.time.trim();
  if (timeIsUnset) {
    if (timeLabel) {
      parts.push(timeLabel);
    }
  } else if (timeLabel) {
    parts.push(timeLabel);
  }

  parts.push(`Full schedule: ${BASE}/sports/${game.sport.globalSportShortname}/schedule`);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function parseVenueCity(location: string): string {
  const city = location.split(",")[0]?.trim();
  return city || "Fresno";
}

/** Sidearm `time` is a Pacific wall clock like "6:00 PM" / "7 PM" (or "TBA"/"TBD"). */
function parseGobulldogsClock(time: string): string | null {
  const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match?.[1] || !match[3]) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function gameStartTs(game: GobulldogsCalendarGame, dayDate: string): string | null {
  if (game.dateUtc) {
    const instant = new Date(game.dateUtc);
    if (!Number.isNaN(instant.getTime())) {
      return instant.toISOString();
    }
  }

  const dayYmd = dayDate.slice(0, 10);

  // No UTC instant (TBD/older feed) — recover the known wall-clock time before falling
  // back to the all-day noon sentinel, so an evening game isn't flattened to midday.
  const hhmm = parseGobulldogsClock(game.time);
  if (hhmm) {
    const pacific = instantFromPacificLocal(dayYmd, hhmm);
    if (pacific) {
      return pacific;
    }
  }

  return dateOnlyStartTs(dayYmd);
}

function gameExternalUrl(game: GobulldogsCalendarGame): string {
  // Sidearm has no per-game detail pages for most sports — only the season schedule.
  return `${BASE}/sports/${game.sport.globalSportShortname}/schedule`;
}

function buildGobulldogsTags(game: GobulldogsCalendarGame, title: string): string[] {
  const tags: string[] = [];
  if (/^football\b/i.test(game.sport.title)) {
    tags.push("sport:football");
  }

  const priorityProbe: NormalizedEvent = {
    source: SOURCE,
    sourceEventId: `gobulldogs:game:${game.id}`,
    title,
    venueName: game.facility?.title || game.location || "Fresno State",
    startTs: "2026-01-01T00:00:00.000Z",
    tags,
    descriptionText: [game.gamePromotionText, game.conferenceTitle, game.opponent.tournamentTitle]
      .filter(Boolean)
      .join(" · ")
  };
  if (isGobulldogsFinalEvent(priorityProbe)) {
    tags.push("final");
  }

  return tags;
}

export function gobulldogsGameToNormalizedEvent(
  game: GobulldogsCalendarGame,
  dayDate: string
): NormalizedEvent | null {
  const title = buildGobulldogsGameTitle(game);
  const startTs = gameStartTs(game, dayDate);
  if (!startTs) {
    return null;
  }

  const venueName = game.facility?.title || game.location || "Fresno State";
  const venueCity = parseVenueCity(game.location || "Fresno, CA");
  const tags = buildGobulldogsTags(game, title);
  const descriptionText = buildGobulldogsDescription(game);
  const footballHome =
    isGobulldogsFootball({
      source: SOURCE,
      sourceEventId: `gobulldogs:game:${game.id}`,
      title,
      venueName,
      startTs
    }) && game.atVs.toLowerCase() !== "at";

  const event: NormalizedEvent = {
    source: SOURCE,
    sourceEventId: `gobulldogs:game:${game.id}`,
    title,
    venueName,
    venueCity,
    startTs,
    timezone: "America/Los_Angeles",
    externalUrl: gameExternalUrl(game),
    category: "sports",
    ...(descriptionText ? { descriptionText } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(game.gameImageUrl ? { imageUrl: game.gameImageUrl } : {}),
    ...(footballHome
      ? { seriesId: GOBULLDOGS_FOOTBALL_SERIES_ID, seriesName: GOBULLDOGS_FOOTBALL_SERIES_NAME }
      : {})
  };

  return withDefaultImageUrl(event, BULLDOGS_DEFAULT_IMAGE_URL);
}

export function gobulldogsCalendarDaysToEvents(days: GobulldogsCalendarDay[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>();

  for (const day of days) {
    for (const game of day.events) {
      const event = gobulldogsGameToNormalizedEvent(game, day.date);
      if (event) {
        byKey.set(event.sourceEventId, event);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.startTs.localeCompare(b.startTs));
}
