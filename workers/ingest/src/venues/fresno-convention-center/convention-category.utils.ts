import type { EventCategory } from "@fresno-events/shared";
import { inferEventCategory } from "@fresno-events/shared";

/** Title-based category defaults when FCC HTML omits taxonomy. */
export function inferConventionCategory(title: string, venueName?: string): EventCategory {
  return inferEventCategory({
    title,
    ...(venueName ? { venueName } : {}),
    fallback: "community"
  });
}
