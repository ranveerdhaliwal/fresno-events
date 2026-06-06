export type CrawlProvider = "ticketsauce" | "listing_page" | "festival" | "headline_only";

/** Input for crawl target resolution (formerly seed_urls rows). */
export interface CrawlSeedInput {
  url: string;
  crawl_hints: Record<string, unknown>;
}

export interface ParsedCrawlHints {
  provider: CrawlProvider;
  horizonMonths: number;
  seriesId?: string;
  extractorVariant?: "festival" | "headline_only";
}

export interface CrawlTarget {
  url: string;
  windowStart?: string;
  windowEnd?: string;
  windowIndex?: number;
  windowTotal?: number;
}

const PACIFIC_TZ = "America/Los_Angeles";
const DEFAULT_HORIZON_MONTHS = 6;

export function parseCrawlHints(hints: Record<string, unknown>): ParsedCrawlHints {
  const rawProvider = hints.provider;
  const provider =
    rawProvider === "ticketsauce" ||
    rawProvider === "listing_page" ||
    rawProvider === "festival" ||
    rawProvider === "headline_only"
      ? rawProvider
      : "listing_page";

  const horizonRaw = hints.horizonMonths;
  const horizonMonths =
    typeof horizonRaw === "number" && Number.isFinite(horizonRaw) && horizonRaw > 0
      ? Math.min(Math.trunc(horizonRaw), 18)
      : DEFAULT_HORIZON_MONTHS;

  const seriesId = typeof hints.seriesId === "string" && hints.seriesId.trim() ? hints.seriesId.trim() : undefined;

  const variantRaw = hints.extractorVariant;
  const extractorVariant =
    variantRaw === "festival" || variantRaw === "headline_only" ? variantRaw : undefined;

  const out: ParsedCrawlHints = { provider, horizonMonths };
  if (seriesId) {
    out.seriesId = seriesId;
  }
  if (extractorVariant) {
    out.extractorVariant = extractorVariant;
  }
  return out;
}

/** First day of month in Pacific, as YYYY-MM-DD. */
function monthStart(year: number, monthIndex: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

/** Last day of month in Pacific, as YYYY-MM-DD. */
function monthEnd(year: number, monthIndex: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const dd = String(last.getUTCDate()).padStart(2, "0");
  const mm = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function pacificYearMonth(now: Date): { year: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "numeric"
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  return { year, monthIndex: month - 1 };
}

function formatPacificDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC_TZ }).format(date);
}

/** Single listing URL with ?start=&end= for TicketSauce (chronological list view). */
export function buildTicketsauceRangeUrl(
  baseUrl: string,
  opts: { now?: Date; horizonMonths?: number } = {}
): string {
  const now = opts.now ?? new Date();
  const horizonMonths = opts.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const start = formatPacificDate(now);
  const { year, monthIndex } = pacificYearMonth(now);
  const endMonth = monthIndex + horizonMonths - 1;
  const endYear = year + Math.floor(endMonth / 12);
  const endMi = ((endMonth % 12) + 12) % 12;
  const end = monthEnd(endYear, endMi);
  const origin = new URL(baseUrl);
  origin.searchParams.set("start", start);
  origin.searchParams.set("end", end);
  return origin.toString();
}

export function buildTicketsauceMonthUrls(
  baseUrl: string,
  opts: { now?: Date; horizonMonths?: number } = {}
): CrawlTarget[] {
  const now = opts.now ?? new Date();
  const horizonMonths = opts.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const origin = new URL(baseUrl);
  const path = origin.pathname === "/" ? "" : origin.pathname;

  const { year, monthIndex } = pacificYearMonth(now);
  const targets: CrawlTarget[] = [];

  for (let i = 0; i < horizonMonths; i += 1) {
    const m = monthIndex + i;
    const y = year + Math.floor(m / 12);
    const mi = ((m % 12) + 12) % 12;
    const start = monthStart(y, mi);
    const end = monthEnd(y, mi);
    const url = `${origin.origin}${path}?start=${start}&end=${end}`;
    targets.push({
      url,
      windowStart: start,
      windowEnd: end,
      windowIndex: i + 1,
      windowTotal: horizonMonths
    });
  }

  return targets;
}

export function resolveCrawlTargets(seed: CrawlSeedInput, now: Date = new Date()): {
  hints: ParsedCrawlHints;
  targets: CrawlTarget[];
} {
  const hints = parseCrawlHints(seed.crawl_hints ?? {});

  if (hints.provider === "ticketsauce") {
    return {
      hints,
      targets: buildTicketsauceMonthUrls(seed.url, { now, horizonMonths: hints.horizonMonths })
    };
  }

  return {
    hints,
    targets: [{ url: seed.url, windowIndex: 1, windowTotal: 1 }]
  };
}

export function usesShallowCrawl(hints: ParsedCrawlHints): boolean {
  return (
    hints.provider === "ticketsauce" ||
    hints.provider === "listing_page" ||
    hints.provider === "festival" ||
    hints.provider === "headline_only"
  );
}

export interface ShouldLogPollInput {
  pollCount: number;
  elapsedMs: number;
  statusChanged: boolean;
  lastLoggedAtMs: number;
  logIntervalMs: number;
}

/** Whether to emit a br_crawl_poll log line (first poll, interval, status change, or final). */
export function shouldLogPoll(input: ShouldLogPollInput): boolean {
  if (input.pollCount <= 1 || input.statusChanged) {
    return true;
  }
  if (input.lastLoggedAtMs <= 0) {
    return true;
  }
  return input.elapsedMs - input.lastLoggedAtMs >= input.logIntervalMs;
}
