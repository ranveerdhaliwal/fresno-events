const PACIFIC_TZ = "America/Los_Angeles";

export interface SaveMartApiMonthRange {
  startYmd: string;
  endYmd: string;
  start: Date;
  end: Date;
}

function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return dt.toISOString().slice(0, 10);
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

function formatYmd(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Build Save-Mart-style daterange listing URLs for N months from now (Pacific). */
export function buildSaveMartMonthListingUrls(baseListingUrl: string, monthWindows: number, now: Date): string[] {
  const origin = new URL(baseListingUrl);
  const { year, monthIndex } = pacificYearMonth(now);
  const urls: string[] = [];

  for (let i = 0; i < monthWindows; i += 1) {
    const m = monthIndex + i;
    const y = year + Math.floor(m / 12);
    const mi = ((m % 12) + 12) % 12;
    const start = formatYmd(y, mi, 1);
    const end = formatYmd(y, mi, lastDayOfMonth(y, mi));
    const u = new URL(origin.href);
    u.searchParams.set("bounds", "false");
    u.searchParams.set("view", "list");
    u.searchParams.set("sort", "date");
    u.searchParams.set("filter_daterange[start]", start);
    u.searchParams.set("filter_daterange[end]", end);
    urls.push(u.href);
  }

  return urls;
}

/** Pacific calendar month windows for Save Mart REST `date_range` queries. */
export function buildSaveMartApiMonthRanges(monthWindows: number, now: Date): SaveMartApiMonthRange[] {
  const { year, monthIndex } = pacificYearMonth(now);
  const ranges: SaveMartApiMonthRange[] = [];

  for (let i = 0; i < monthWindows; i += 1) {
    const m = monthIndex + i;
    const y = year + Math.floor(m / 12);
    const mi = ((m % 12) + 12) % 12;
    const startYmd = formatYmd(y, mi, 1);
    const endYmd = formatYmd(y, mi, lastDayOfMonth(y, mi));
    ranges.push({
      startYmd,
      endYmd,
      // Save Mart API uses Pacific-midnight-style UTC anchors (e.g. 2026-06-05T07:00:00.000Z).
      start: new Date(`${startYmd}T07:00:00.000Z`),
      end: new Date(`${addDaysYmd(endYmd, 1)}T07:00:00.000Z`)
    });
  }

  return ranges;
}
