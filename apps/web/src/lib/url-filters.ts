import type { DatePreset } from "@/lib/date-presets";

const DATE_PRESETS: DatePreset[] = ["tonight", "tomorrow", "weekend", "week"];

export interface UrlFilters {
  q: string;
  datePreset: DatePreset | null;
}

export function parseUrlFilters(search: string): UrlFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const q = params.get("q")?.trim() ?? "";
  const d = params.get("d")?.trim() ?? "";
  const datePreset = DATE_PRESETS.includes(d as DatePreset) ? (d as DatePreset) : null;
  return { q, datePreset };
}

export function buildUrlFilters(filters: UrlFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.datePreset) {
    params.set("d", filters.datePreset);
  }
  return params;
}
