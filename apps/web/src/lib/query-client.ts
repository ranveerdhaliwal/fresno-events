import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      // Default is 3 retries with exponential backoff, which keeps a section in
      // its loading skeleton for close to a minute when the API is failing.
      // One bounded retry still rides out a blip but surfaces real outages fast.
      retry: 1,
      retryDelay: 1000
    }
  }
});
