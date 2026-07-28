/** Title-case a dual-font script phrase ("what's on" → "What's On"). */
export function capitalizeScriptPhrase(script: string): string {
  return script
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Shared Yellowtail slogan used in footer + event share card. */
export const CENTRAL_VALLEY_GREETING = "Greetings from the Central Valley";
