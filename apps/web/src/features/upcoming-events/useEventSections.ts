import { useQuery } from "@tanstack/react-query";

import { getEventSections } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

export function useEventSections() {
  return useQuery({
    queryKey: eventsKeys.sections(),
    queryFn: ({ signal }) => getEventSections(signal),
    staleTime: 1000 * 60 * 5
  });
}
