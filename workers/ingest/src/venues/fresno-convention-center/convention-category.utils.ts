import type { EventCategory } from "@fresno-events/shared";

/** Title-based category defaults when FCC HTML omits taxonomy. */
export function inferConventionCategory(title: string): EventCategory {
  const key = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (!key) {
    return "community";
  }

  if (/\b(bluey|pageant|miss california)\b/.test(key)) {
    return "family";
  }

  if (/\b(combat|fighting|wrestling|mma|boxing|cage)\b/.test(key)) {
    return "sports";
  }

  if (/\b(ballet|nutcracker|swan lake|musical|doubtfire|opera)\b/.test(key)) {
    return "theater";
  }

  if (/\b(comedy|comedian|stand-?up)\b/.test(key)) {
    return "comedy";
  }

  if (
    /\b(concert|live in|tour\b|grupo|mariach|symphony|orchestra|floyd|armado|panchos|zz top|sonic)\b/.test(
      key
    )
  ) {
    return "music";
  }

  return "community";
}
