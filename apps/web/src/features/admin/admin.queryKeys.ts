export const adminKeys = {
  all: ["admin"] as const,
  homepageSlots: () => [...adminKeys.all, "homepage-slots"] as const,
  eventSearch: (q: string, scope?: string) => [...adminKeys.all, "event-search", q, scope ?? "future"] as const,
  publishedEventsList: (scope: string, offset: number, q: string) =>
    [...adminKeys.all, "published-events", scope, offset, q] as const,
  publishedEvent: (eventId: string) => [...adminKeys.all, "published-event", eventId] as const
};
