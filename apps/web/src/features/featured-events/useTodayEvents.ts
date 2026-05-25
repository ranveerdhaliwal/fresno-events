import { useQuery } from "@tanstack/react-query";

import { eventsKeys } from "@/services/events.queryKeys";
import { listTodayEvents } from "@/features/events/api";

export function useTodayEvents() {
  return useQuery({
    queryKey: eventsKeys.today(),
    queryFn: ({ signal }) => listTodayEvents(signal),
    staleTime: 1000 * 60 * 5
  });
}
