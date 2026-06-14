import type { NormalizedEvent } from "@fresno-events/shared";

export interface LinkedPriceMember {
  id: string;
  source: string;
  canonical_candidate_id: string | null;
  normalized_event: NormalizedEvent;
}

export function hasUsablePrice(event: NormalizedEvent): boolean {
  if (event.isFree === true) {
    return true;
  }
  if (typeof event.priceMin === "number" || typeof event.priceMax === "number") {
    return true;
  }
  return Boolean(event.priceNotes?.trim());
}

function priceRichnessScore(event: NormalizedEvent): number {
  if (event.isFree === true) {
    return 1;
  }
  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return 4;
  }
  if (typeof event.priceMin === "number") {
    return 3;
  }
  if (event.priceNotes?.trim()) {
    return 2;
  }
  return 0;
}

/** Prefer venue/fair scrapes over Ticketmaster when price quality ties. */
function sourcePricePreference(source: string): number {
  return source === "ticketmaster" ? 0 : 1;
}

export function pickBestPriceMember(
  members: readonly LinkedPriceMember[]
): LinkedPriceMember | null {
  let best: LinkedPriceMember | null = null;
  let bestScore = 0;
  let bestSourcePref = -1;

  for (const member of members) {
    const event = member.normalized_event;
    if (!hasUsablePrice(event)) {
      continue;
    }
    const score = priceRichnessScore(event);
    const sourcePref = sourcePricePreference(member.source);
    if (
      score > bestScore ||
      (score === bestScore && sourcePref > bestSourcePref)
    ) {
      best = member;
      bestScore = score;
      bestSourcePref = sourcePref;
    }
  }

  return best;
}

export function mergeInheritedPrice(
  target: NormalizedEvent,
  source: NormalizedEvent
): NormalizedEvent | null {
  if (hasUsablePrice(target) || !hasUsablePrice(source)) {
    return null;
  }

  if (source.isFree === true) {
    return {
      ...target,
      isFree: true,
      priceMin: 0,
      priceMax: 0,
      currency: source.currency ?? target.currency ?? "USD"
    };
  }

  const next: NormalizedEvent = { ...target };
  if (typeof source.priceMin === "number") {
    next.priceMin = source.priceMin;
  }
  if (typeof source.priceMax === "number") {
    next.priceMax = source.priceMax;
  }
  const notes = source.priceNotes?.trim();
  if (notes) {
    next.priceNotes = notes;
  }
  if (source.currency) {
    next.currency = source.currency;
  }
  return next;
}

export function buildLinkedPricePatches(
  members: readonly LinkedPriceMember[]
): Array<{ id: string; normalized_event: NormalizedEvent; fromSource: string }> {
  const donor = pickBestPriceMember(members);
  if (!donor) {
    return [];
  }

  const patches: Array<{ id: string; normalized_event: NormalizedEvent; fromSource: string }> = [];
  for (const member of members) {
    const merged = mergeInheritedPrice(member.normalized_event, donor.normalized_event);
    if (merged) {
      patches.push({ id: member.id, normalized_event: merged, fromSource: donor.source });
    }
  }

  return patches;
}
