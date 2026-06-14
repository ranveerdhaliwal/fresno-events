import { useQuery } from "@tanstack/react-query";

import { listWeekThroughSunday } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

export function useWeekThroughSunday() {
  return useQuery({
    queryKey: eventsKeys.weekThroughSunday(),
    queryFn: ({ signal }) => listWeekThroughSunday(signal),
    staleTime: 1000 * 60 * 5
  });
}
