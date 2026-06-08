import type { EventCategory } from "@fresno-events/shared";

export interface TicketmasterClassification {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
}

export interface TicketmasterVenue {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  location?: { latitude?: string | number; longitude?: string | number };
}

export interface TicketmasterImage {
  url?: string;
  width?: number;
}

export interface TicketmasterEvent {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  dates?: {
    timezone?: string;
    start?: {
      dateTime?: string;
      localDate?: string;
      localTime?: string;
    };
  };
  classifications?: TicketmasterClassification[];
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  images?: TicketmasterImage[];
  _embedded?: { venues?: TicketmasterVenue[] };
}

export interface TicketmasterPageMeta {
  totalPages?: number;
  number?: number;
}

export interface TicketmasterResponse {
  _embedded?: { events?: TicketmasterEvent[] };
  page?: TicketmasterPageMeta;
}

export function toCategory(classification: TicketmasterClassification | undefined): EventCategory {
  const segment = classification?.segment?.name?.toLowerCase() ?? "";
  const genre = classification?.genre?.name?.toLowerCase() ?? "";
  const values = `${segment} ${genre}`;

  if (values.includes("music")) return "music";
  if (values.includes("comedy")) return "comedy";
  if (values.includes("theatre") || values.includes("theater")) return "theater";
  if (values.includes("sport")) return "sports";
  if (values.includes("family")) return "family";
  if (values.includes("arts")) return "art";

  return "community";
}

export function toLocalDateTime(localDate?: string, localTime?: string): string | null {
  if (!localDate) {
    return null;
  }

  return `${localDate}T${localTime ?? "00:00:00"}-07:00`;
}

export function chooseImage(images: TicketmasterImage[] | undefined): TicketmasterImage | undefined {
  return [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
}

export function isString(value: string | undefined): value is string {
  return Boolean(value);
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readCoordinate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
