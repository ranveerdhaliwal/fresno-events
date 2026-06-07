import type { NormalizedEvent } from "@fresno-events/shared";

export interface DefaultImageOptions {
  /** List rows at priority 5 still show this venue logo (e.g. Chaffee Zoo). */
  showInCommunityList?: boolean;
  /** Inset (px) inside list thumbnail; lower = larger logo (default 6). */
  listVenueLogoPadding?: number;
}

/** Keep an existing poster; otherwise apply a venue default. */
export function withDefaultImageUrl(
  event: NormalizedEvent,
  defaultUrl: string,
  options?: DefaultImageOptions
): NormalizedEvent {
  if (event.imageUrl?.trim()) {
    return event;
  }
  return {
    ...event,
    imageUrl: defaultUrl,
    ...(options?.showInCommunityList ? { showVenueLogoInList: true } : {}),
    ...(options?.listVenueLogoPadding !== undefined
      ? { listVenueLogoPadding: options.listVenueLogoPadding }
      : {})
  };
}
