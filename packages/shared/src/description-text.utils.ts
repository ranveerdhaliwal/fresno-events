const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  mdash: "—",
  ndash: "-",
  middot: "·",
  hellip: "..."
};

/** Decode common HTML entities in scraped plain text or CMS HTML fragments. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function normalizeDescriptionLine(line: string): string {
  return line.replace(/[\t\u00a0]+/g, " ").replace(/ +/g, " ").trim();
}

/** Remove bracketed domain placeholders like [podcasts.apple.com] from ticket copy. */
export function stripBracketedLinkPlaceholders(text: string): string {
  return text.replace(/\s*\[[^\]\s/]+\.[^\]\s/]+\]\s*/g, " ");
}

/**
 * Normalize description text from any ingest source: decode entities, strip placeholder
 * link brackets, collapse blank lines, and trim noise from HTML-ish payloads.
 */
export function sanitizeIngestDescriptionText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  let value = decodeHtmlEntities(trimmed);
  value = value.replace(/\r\n?/g, "\n");

  if (/<[a-z][\s\S]*>/i.test(value)) {
    value = value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");
    value = decodeHtmlEntities(value);
  }

  value = stripBracketedLinkPlaceholders(value);
  value = value.replace(/ \./g, ".");
  value = value.replace(/\.([A-Z])/g, ".\n\n$1");

  const lines: string[] = [];
  let blankRun = 0;
  for (const rawLine of value.split("\n")) {
    const line = normalizeDescriptionLine(rawLine);
    if (!line) {
      blankRun += 1;
      if (blankRun <= 1) {
        lines.push("");
      }
      continue;
    }
    blankRun = 0;
    lines.push(line);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
