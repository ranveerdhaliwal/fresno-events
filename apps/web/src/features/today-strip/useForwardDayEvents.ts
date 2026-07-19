import { useQuery } from "@tanstack/react-query";
import { addDaysToIsoDate, pacificEndOfDay, pacificStartOfDay, pacificTodayIso } from "@fresno-events/shared";

import { eventsKeys } from "@/services/events.queryKeys";
import { listWeekEvents } from "@/services/events.service";

const FORWARD_DAY_COUNT = 14;

/** Events from Pacific today through the next two weeks (for date-strip counts). */
export function useForwardDayEvents() {
  const todayIso = pacificTodayIso();
  const untilIso = addDaysToIsoDate(todayIso, FORWARD_DAY_COUNT - 1);

  return useQuery({
    queryKey: eventsKeys.week(todayIso, untilIso),
    queryFn: ({ signal }) =>
      listWeekEvents({
        from: pacificStartOfDay(todayIso),
        until: pacificEndOfDay(untilIso),
        signal,
        limit: 200
      }),
    staleTime: 1000 * 60 * 5
  });
}
