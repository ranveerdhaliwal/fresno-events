import type { EventListItem } from "@fresno-events/shared";

export interface CalendarDayTileProps {
  isoDate: string;
  preview: EventListItem[];
  hidden: number;
  total: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}
