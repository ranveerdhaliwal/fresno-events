/** Day-of-week label (SUN … SAT) for a Pacific ISO date. */
export function pacificDowShort(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dow] ?? "";
}

export function isPacificWeekend(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return dow === 0 || dow === 6;
}
