import { useQuery } from "@tanstack/react-query";

import { getLocalContext } from "@/services/context.service";

export const contextKeys = {
  local: () => ["context", "local"] as const
};

export function useLocalContext() {
  return useQuery({
    queryKey: contextKeys.local(),
    queryFn: ({ signal }) => getLocalContext(signal),
    staleTime: 1000 * 60 * 15
  });
}
