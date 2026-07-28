import type { NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

const TeamSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    teamName: z.string().optional()
  })
});

const GameSchema = z.object({
  gamePk: z.number(),
  gameDate: z.string(),
  officialDate: z.string().optional(),
  venue: z
    .object({
      name: z.string().optional()
    })
    .optional(),
  teams: z.object({
    home: TeamSchema,
    away: TeamSchema
  })
});

const ScheduleSchema = z.object({
  dates: z.array(
    z.object({
      games: z.array(GameSchema).optional()
    })
  )
});

export type MilbSchedule = z.infer<typeof ScheduleSchema>;

/** Official Grizzlies primary logo on MLB CDN (same asset as milb.com/fresno). */
export const GRIZZLIES_DEFAULT_IMAGE_URL = "https://www.mlbstatic.com/team-logos/259.svg";

/** Org-level MiLB tickets portal (statsapi does not expose per-game tickets.com event ids). */
export const GRIZZLIES_TICKETS_ORG_URL = "https://mlb.tickets.com/?orgId=57456&agency=MILB_MPV";

const GRIZZLIES_TEAM_ID = 259;

/** Expand airport-style / abbreviated away venues so list rows read clearly. */
const AWAY_VENUE_DISPLAY: Record<string, { venueName: string; venueCity: string }> = {
  "ont field": { venueName: "ONT Field (Ontario, CA)", venueCity: "Ontario" }
};

function resolveMilbVenue(
  game: z.infer<typeof GameSchema>,
  isHome: boolean,
  opponentName: string
): { venueName: string; venueCity: string } {
  const raw = game.venue?.name?.trim() ?? "";
  if (isHome) {
    return { venueName: raw || "Chukchansi Park", venueCity: "Fresno" };
  }
  const mapped = AWAY_VENUE_DISPLAY[raw.toLowerCase()];
  if (mapped) {
    return mapped;
  }
  if (raw) {
    return { venueName: raw, venueCity: "Fresno" };
  }
  return { venueName: opponentName, venueCity: "Fresno" };
}

function teamSlug(team: { teamName?: string | undefined; name: string }): string {
  const raw = team.teamName?.trim() || team.name.split(/\s+/).pop() || team.name;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. https://www.milb.com/gameday/ports-vs-grizzlies/2026/08/23/821367/preview */
export function buildMilbGamedayUrl(game: z.infer<typeof GameSchema>): string {
  const awaySlug = teamSlug(game.teams.away.team);
  const homeSlug = teamSlug(game.teams.home.team);
  const dateYmd = game.officialDate ?? game.gameDate.slice(0, 10);
  const [year, month, day] = dateYmd.split("-");
  return `https://www.milb.com/gameday/${awaySlug}-vs-${homeSlug}/${year}/${month}/${day}/${game.gamePk}/preview`;
}

export function buildMilbScheduleUrl(opts: { now: Date; horizonDays: number }): string {
  const end = new Date(opts.now.getTime() + opts.horizonDays * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
  url.searchParams.set("teamId", String(GRIZZLIES_TEAM_ID));
  url.searchParams.set("sportId", "14");
  url.searchParams.set("startDate", fmt(opts.now));
  url.searchParams.set("endDate", fmt(end));
  url.searchParams.set("hydrate", "team,venue");
  return url.toString();
}

export function parseMilbSchedule(json: unknown): MilbSchedule {
  return ScheduleSchema.parse(json);
}

export function toNormalizedEvents(schedule: MilbSchedule): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  for (const day of schedule.dates) {
    for (const game of day.games ?? []) {
      const home = game.teams.home.team;
      const away = game.teams.away.team;
      const isHome = home.id === GRIZZLIES_TEAM_ID;
      const opponent = isHome ? away.name : home.name;
      const title = isHome ? `Fresno Grizzlies vs ${opponent}` : `Fresno Grizzlies at ${opponent}`;
      const venue = resolveMilbVenue(game, isHome, opponent);

      events.push({
        source: "api:milb",
        sourceEventId: String(game.gamePk),
        title,
        venueName: venue.venueName,
        venueCity: venue.venueCity,
        startTs: new Date(game.gameDate).toISOString(),
        category: "sports",
        externalUrl: buildMilbGamedayUrl(game),
        ticketUrl: GRIZZLIES_TICKETS_ORG_URL,
        imageUrl: GRIZZLIES_DEFAULT_IMAGE_URL,
        showVenueLogoInList: true,
        listVenueLogoPadding: 10
      });
    }
  }

  return events;
}
