import type { NormalizedEvent } from "@fresno-events/shared";
import { z } from "zod";

const TeamSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string()
  })
});

const GameSchema = z.object({
  gamePk: z.number(),
  gameDate: z.string(),
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

export function buildMilbScheduleUrl(opts: { now: Date; horizonDays: number }): string {
  const end = new Date(opts.now.getTime() + opts.horizonDays * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
  url.searchParams.set("teamId", "259");
  url.searchParams.set("sportId", "14");
  url.searchParams.set("startDate", fmt(opts.now));
  url.searchParams.set("endDate", fmt(end));
  return url.toString();
}

export function parseMilbSchedule(json: unknown): MilbSchedule {
  return ScheduleSchema.parse(json);
}

export function toNormalizedEvents(schedule: MilbSchedule): NormalizedEvent[] {
  const grizzliesId = 259;
  const events: NormalizedEvent[] = [];

  for (const day of schedule.dates) {
    for (const game of day.games ?? []) {
      const home = game.teams.home.team;
      const away = game.teams.away.team;
      const isHome = home.id === grizzliesId;
      const opponent = isHome ? away.name : home.name;
      const title = isHome ? `Fresno Grizzlies vs ${opponent}` : `Fresno Grizzlies at ${opponent}`;

      events.push({
        source: "api:milb",
        sourceEventId: String(game.gamePk),
        title,
        venueName: game.venue?.name ?? (isHome ? "Chukchansi Park" : opponent),
        venueCity: "Fresno",
        startTs: new Date(game.gameDate).toISOString(),
        category: "sports",
        externalUrl: `https://www.milb.com/fresno/schedule`
      });
    }
  }

  return events;
}
