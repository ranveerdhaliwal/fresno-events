export const adminKeys = {
  all: ["admin"] as const,
  homepageSlots: () => [...adminKeys.all, "homepage-slots"] as const,
  eventSearch: (q: string, scope?: string) => [...adminKeys.all, "event-search", q, scope ?? "future"] as const,
  publishedEvent: (eventId: string) => [...adminKeys.all, "published-event", eventId] as const
};
