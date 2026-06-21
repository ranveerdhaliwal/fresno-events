import type { NormalizedEvent } from "@fresno-events/shared";

import type { VenunitePriceWatchSchema } from "./venunite.types";
import type { z } from "zod";

type VenunitePriceWatch = z.infer<typeof VenunitePriceWatchSchema>;

export function isVenuniteFreeCostText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (/^free(?:\s+(?:entry|admission|event))?\s*\.?$/i.test(normalized)) {
    return true;
  }

  if (/^(?:no\s+charge|complimentary(?:\s+admission)?)\s*\.?$/i.test(normalized)) {
    return true;
  }

  // "$0" or "$0 - $0" only — not "$0-$20".
  return /^\$0(?:\.00)?(?:\s*[-–]\s*\$0(?:\.00)?)?\s*\.?$/i.test(normalized);
}

export function resolveVenunitePriceFields(
  priceWatch?: VenunitePriceWatch | null,
  cost?: string | null
): Pick<NormalizedEvent, "isFree" | "priceMin" | "priceMax" | "priceNotes" | "currency"> {
  const minCents = priceWatch?.minPriceCents;
  const maxCents = priceWatch?.maxPriceCents;
  const displayPrice = priceWatch?.displayPrice?.trim();
  const costText = cost?.trim();
  const currency = priceWatch?.currency ?? "USD";

  if (minCents === 0 && (maxCents === 0 || maxCents == null)) {
    const note = costText || displayPrice;
    return {
      isFree: true,
      priceMin: 0,
      priceMax: 0,
      currency,
      ...(note ? { priceNotes: note } : {})
    };
  }

  for (const candidate of [costText, displayPrice]) {
    if (candidate && isVenuniteFreeCostText(candidate)) {
      return {
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        priceNotes: candidate,
        currency
      };
    }
  }

  const paid: Pick<NormalizedEvent, "priceMin" | "priceMax" | "currency"> = { currency };
  if (minCents != null && minCents > 0) {
    paid.priceMin = minCents / 100;
  }
  if (maxCents != null && maxCents > 0) {
    paid.priceMax = maxCents / 100;
  }

  return paid;
}

/** Backfill isFree when only the Venunite cost stub landed in descriptionText. */
export function applyVenuniteFreeAdmissionFields(
  event: Pick<NormalizedEvent, "isFree" | "descriptionText" | "priceMin" | "priceMax">
): Pick<NormalizedEvent, "isFree" | "priceMin" | "priceMax"> {
  if (event.isFree === true) {
    return {};
  }

  const description = event.descriptionText?.trim();
  if (!description) {
    return {};
  }

  const costMatch = /^Cost:\s*(.+)$/i.exec(description);
  const costValue = costMatch?.[1]?.trim();
  if (!costValue || !isVenuniteFreeCostText(costValue)) {
    return {};
  }

  return { isFree: true, priceMin: 0, priceMax: 0 };
}
