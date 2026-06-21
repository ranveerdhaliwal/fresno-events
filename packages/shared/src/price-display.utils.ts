/** Round up to whole dollars — display estimate only; ticket URL is authoritative. */
export function roundDisplayPriceUp(price: number): number {
  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }
  return Math.ceil(price);
}

export function applyDisplayPriceRounding<T extends {
  isFree?: boolean;
  priceMin?: number;
  priceMax?: number;
}>(event: T): T {
  if (event.isFree === true) {
    return event;
  }

  let priceMin = event.priceMin;
  let priceMax = event.priceMax;
  let changed = false;

  if (typeof priceMin === "number" && priceMin > 0) {
    const rounded = roundDisplayPriceUp(priceMin);
    if (rounded !== priceMin) {
      priceMin = rounded;
      changed = true;
    }
  }

  if (typeof priceMax === "number" && priceMax > 0) {
    const rounded = roundDisplayPriceUp(priceMax);
    if (rounded !== priceMax) {
      priceMax = rounded;
      changed = true;
    }
  }

  if (
    typeof priceMin === "number" &&
    typeof priceMax === "number" &&
    priceMax < priceMin
  ) {
    priceMax = priceMin;
    changed = true;
  }

  if (!changed) {
    return event;
  }

  return {
    ...event,
    ...(typeof priceMin === "number" ? { priceMin } : {}),
    ...(typeof priceMax === "number" ? { priceMax } : {})
  };
}
