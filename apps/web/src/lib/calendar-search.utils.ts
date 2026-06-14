import { pacificTodayIso } from "@fresno-events/shared";

/** Default search params for `/calendar` links (current Pacific month). */
export function calendarSearchCurrent(): { year: number; month: number } {
  const [year, month] = pacificTodayIso().split("-").map(Number);
  return { year: year!, month: month! };
}
