import { useQuery } from "@tanstack/react-query";

import { getEventDetail } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

export function useEventDetail(slug: string) {
  return useQuery({
    queryKey: eventsKeys.detail(slug),
    queryFn: ({ signal }) => getEventDetail(slug, signal),
    staleTime: 1000 * 60 * 5
  });
}
