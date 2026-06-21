import type { Event } from "@fresno-events/shared";

export type EventPriceFields = Pick<Event, "isFree" | "priceMin" | "priceMax" | "ticketUrl"> & {
  priceNotes?: string;
};

export function eventIsFree(event: EventPriceFields): boolean {
  return event.isFree === true || (event.priceMin === 0 && event.priceMax === 0);
}

function formatNumericPrice(event: EventPriceFields): string {
  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return event.priceMin === event.priceMax ? `$${event.priceMin}` : `$${event.priceMin}-${event.priceMax}`;
  }
  if (typeof event.priceMin === "number") {
    return `$${event.priceMin}`;
  }
  return "";
}

/** List rows/cards: show $40+ when a range is stored; detail keeps full min–max. */
function formatListNumericPrice(event: EventPriceFields): string {
  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return event.priceMin === event.priceMax ? `$${event.priceMin}` : `$${event.priceMin}+`;
  }
  if (typeof event.priceMin === "number") {
    return `$${event.priceMin}`;
  }
  return "";
}

/** List rows/cards when price is unknown but a ticket URL exists. */
export const LIST_TICKET_PRICE_LABEL = "See Tickets for price";

export function isListTicketPriceLabel(label: string): boolean {
  return label === LIST_TICKET_PRICE_LABEL;
}

/** Label for list rows and cards. */
export function formatListPrice(event: EventPriceFields): string {
  if (eventIsFree(event)) {
    return "Free";
  }
  const numeric = formatListNumericPrice(event);
  if (numeric) {
    return numeric;
  }
  if (event.ticketUrl?.trim()) {
    return LIST_TICKET_PRICE_LABEL;
  }
  return "";
}

/** Fuller copy for the event detail quick-facts block. */
export function formatDetailPrice(event: EventPriceFields): string {
  if (eventIsFree(event)) {
    return "Free";
  }
  const numeric = formatNumericPrice(event);
  if (numeric) {
    return numeric;
  }
  const notes = event.priceNotes?.trim();
  if (notes) {
    return notes;
  }
  if (event.ticketUrl?.trim()) {
    return "See tickets for price";
  }
  return "";
}
