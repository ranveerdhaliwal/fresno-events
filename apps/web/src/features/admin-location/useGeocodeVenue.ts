import { useMutation } from "@tanstack/react-query";

import { AdminApiError, geocodeVenueAddress } from "@/features/admin/admin-api";

export function useGeocodeVenue(token: string) {
  return useMutation({
    mutationFn: (input: { address: string; city?: string }) => geocodeVenueAddress(token, input),
    retry: false
  });
}

export function geocodeErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }
  return "Geocode failed.";
}
