export const eventsKeys = {
  all: ["events"] as const,
  today: () => [...eventsKeys.all, "today"] as const,
  homepage: () => [...eventsKeys.all, "homepage"] as const,
  sections: () => [...eventsKeys.all, "sections"] as const,
  calendar: (year: number, month: number) => [...eventsKeys.all, "calendar", year, month] as const,
  week: (from: string, until: string) => [...eventsKeys.all, "week", from, until] as const,
  weekThroughSunday: () => [...eventsKeys.all, "week-through-sunday"] as const,
  day: (isoDate: string) => [...eventsKeys.all, "day", isoDate] as const,
  dayRange: (isoDate: string) => [...eventsKeys.all, "day", isoDate, "events"] as const,
  detail: (slug: string) => [...eventsKeys.all, "detail", slug] as const,
  series: (seriesId: string) => [...eventsKeys.all, "series", seriesId] as const,
  venue: (slug: string) => [...eventsKeys.all, "venue", slug] as const
};
