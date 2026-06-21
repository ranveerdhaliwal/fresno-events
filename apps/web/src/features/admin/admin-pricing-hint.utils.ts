import type { NormalizedEvent } from "@fresno-events/shared";

export type AdminPricingHint =
  | { kind: "free"; label: string }
  | { kind: "priced"; label: string }
  | { kind: "unknown"; label: string };

/**
 * What the public site can show from ingest fields alone.
 * Does not infer paid vs free from ticket URLs — Ticketmaster lists free events too.
 */
export function inferAdminPricingHint(event: NormalizedEvent): AdminPricingHint | null {
  if (event.isFree || (event.priceMin === 0 && event.priceMax === 0)) {
    return { kind: "free", label: "Free" };
  }

  const priceLabel = formatNormalizedPrice(event);
  if (priceLabel) {
    return { kind: "priced", label: priceLabel };
  }

  const notes = event.priceNotes?.trim();
  if (notes) {
    return { kind: "priced", label: notes };
  }

  if (event.source === "ticketmaster" || event.ticketUrl?.trim()) {
    return {
      kind: "unknown",
      label: "No price from source — check Free or enter min/max; list shows See Tickets for price when a ticket URL is set"
    };
  }

  return null;
}

function formatNormalizedPrice(event: NormalizedEvent): string {
  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return event.priceMin === event.priceMax ? `$${event.priceMin}` : `$${event.priceMin}-${event.priceMax}`;
  }
  if (typeof event.priceMin === "number") {
    return `$${event.priceMin}`;
  }
  return "";
}
