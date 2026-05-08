import { useQuery } from "@tanstack/react-query";

import { getEventDetail, listWeekEvents } from "./api";

export function useWeekEvents(from: Date, until: Date) {
  return useQuery({
    queryKey: ["events", "week", from.toISOString(), until.toISOString()],
    queryFn: ({ signal }) => listWeekEvents({ from, until, signal }),
    staleTime: 1000 * 60 * 5
  });
}

export function useEventDetail(slug: string) {
  return useQuery({
    queryKey: ["events", "detail", slug],
    queryFn: ({ signal }) => getEventDetail(slug, signal),
    staleTime: 1000 * 60 * 5
  });
}
