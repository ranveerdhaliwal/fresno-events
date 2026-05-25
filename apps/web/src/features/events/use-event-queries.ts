import { useQuery } from "@tanstack/react-query";

import { eventsKeys } from "@/services/events.queryKeys";
import { getEventDetail, listWeekEvents } from "@/services/events.service";

export function useWeekEvents(from: Date, until: Date) {
  return useQuery({
    queryKey: eventsKeys.week(from.toISOString(), until.toISOString()),
    queryFn: ({ signal }) => listWeekEvents({ from, until, signal }),
    staleTime: 1000 * 60 * 5
  });
}

export function useEventDetail(slug: string) {
  return useQuery({
    queryKey: eventsKeys.detail(slug),
    queryFn: ({ signal }) => getEventDetail(slug, signal),
    staleTime: 1000 * 60 * 5
  });
}
