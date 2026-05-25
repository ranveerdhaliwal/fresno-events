export const eventsKeys = {
  all: ["events"] as const,
  today: () => [...eventsKeys.all, "today"] as const,
  week: (from: string, until: string) => [...eventsKeys.all, "week", from, until] as const,
  day: (isoDate: string) => [...eventsKeys.all, "day", isoDate] as const,
  dayRange: (isoDate: string) => [...eventsKeys.all, "day", isoDate, "events"] as const,
  detail: (slug: string) => [...eventsKeys.all, "detail", slug] as const
};
