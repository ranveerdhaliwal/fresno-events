import { useQuery } from "@tanstack/react-query";

import { listTodayEvents } from "./api";

export function useTodayEvents() {
  return useQuery({
    queryKey: ["events", "today"],
    queryFn: ({ signal }) => listTodayEvents(signal),
    staleTime: 1000 * 60 * 5
  });
}
