import type { EventSource } from "@fresno-events/shared";

const FIXED_SOURCES = ["ticketmaster", "eventbrite", "bandsintown", "seatgeek", "manual", "recurring"] as const;

export function toEventSource(value: string): EventSource {
  if ((FIXED_SOURCES as readonly string[]).includes(value)) {
    return value as EventSource;
  }

  if (value.startsWith("scrape:") || value.startsWith("api:") || value.startsWith("manual:")) {
    return value as EventSource;
  }

  return "manual";
}

export function isValidSource(value: string): boolean {
  return toEventSource(value) === value;
}
