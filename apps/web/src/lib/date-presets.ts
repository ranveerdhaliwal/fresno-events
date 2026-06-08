import { getPacificDateTimeParts } from "@/lib/pacific-time";

export type DatePreset = "tonight" | "tomorrow" | "weekend" | "week";

export interface DatePresetRange {
  from: Date;
  until: Date;
}

function parsePacificDateParts(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function pacificDateToInstant(isoDate: string, hour: number, minute: number): Date {
  const { year, month, day } = parsePacificDateParts(isoDate);
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const pacific = getPacificDateTimeParts(probe);
  const offsetHours = 12 - pacific.hour - pacific.minute / 60;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetHours * 60 * 60 * 1000;
  return new Date(utcMs);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const { year, month, day } = parsePacificDateParts(isoDate);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return getPacificDateTimeParts(next).date;
}

function endOfPacificDay(isoDate: string): Date {
  const nextDay = addDaysToIsoDate(isoDate, 1);
  return new Date(pacificDateToInstant(nextDay, 0, 0).getTime() - 1);
}

function nextSaturdayIso(fromIso: string): string {
  const { year, month, day } = parsePacificDateParts(fromIso);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilSaturday = (6 - dow + 7) % 7;
  return addDaysToIsoDate(fromIso, daysUntilSaturday);
}

export function resolveDatePreset(preset: DatePreset, now = new Date()): DatePresetRange {
  const todayIso = getPacificDateTimeParts(now).date;

  switch (preset) {
    case "tonight":
      return { from: now, until: endOfPacificDay(todayIso) };
    case "tomorrow": {
      const tomorrowIso = addDaysToIsoDate(todayIso, 1);
      return {
        from: pacificDateToInstant(tomorrowIso, 0, 0),
        until: endOfPacificDay(tomorrowIso)
      };
    }
    case "weekend": {
      const saturdayIso = nextSaturdayIso(todayIso);
      const sundayIso = addDaysToIsoDate(saturdayIso, 1);
      return {
        from: pacificDateToInstant(saturdayIso, 0, 0),
        until: endOfPacificDay(sundayIso)
      };
    }
    case "week": {
      const weekEndIso = addDaysToIsoDate(todayIso, 6);
      return { from: now, until: endOfPacificDay(weekEndIso) };
    }
  }
}
