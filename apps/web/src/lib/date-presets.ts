import {
  addDaysToIsoDate,
  nextSaturdayIso,
  pacificEndOfDay,
  pacificStartOfDay,
  pacificTodayIso
} from "@fresno-events/shared";

export type DatePreset = "tonight" | "tomorrow" | "weekend" | "week";

export interface DatePresetRange {
  from: Date;
  until: Date;
}

export function resolveDatePreset(preset: DatePreset, now = new Date()): DatePresetRange {
  const todayIso = pacificTodayIso(now);

  switch (preset) {
    case "tonight":
      return { from: now, until: pacificEndOfDay(todayIso) };
    case "tomorrow": {
      const tomorrowIso = addDaysToIsoDate(todayIso, 1);
      return {
        from: pacificStartOfDay(tomorrowIso),
        until: pacificEndOfDay(tomorrowIso)
      };
    }
    case "weekend": {
      const saturdayIso = nextSaturdayIso(todayIso);
      const sundayIso = addDaysToIsoDate(saturdayIso, 1);
      return {
        from: pacificStartOfDay(saturdayIso),
        until: pacificEndOfDay(sundayIso)
      };
    }
    case "week": {
      const weekEndIso = addDaysToIsoDate(todayIso, 6);
      return { from: now, until: pacificEndOfDay(weekEndIso) };
    }
  }
}
