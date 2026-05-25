import { useQuery } from "@tanstack/react-query";

import { eventsKeys } from "@/services/events.queryKeys";
import { listDayEvents } from "@/services/events.service";

export function useDayEvents(isoDate: string) {
  return useQuery({
    queryKey: eventsKeys.dayRange(isoDate),
    queryFn: ({ signal }) => listDayEvents(isoDate, signal),
    staleTime: 1000 * 60 * 5
  });
}
