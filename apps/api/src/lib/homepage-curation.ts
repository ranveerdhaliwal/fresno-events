import type {
  EventListItem,
  EventStatus,
  HomepageCurationResponse,
  HomepageSection,
  HomepageSlotItem,
  HomepageSlotRow,
  HomepageSlotsResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { listEventsByIds, listEventsFromSupabase } from "@/lib/supabase-events";
import { supabaseRequest } from "@/lib/supabase-client";

const HOMEPAGE_LIST_FROM_MS = 6 * 60 * 60 * 1000;
const SCHEDULED_STATUSES = new Set<EventStatus>(["scheduled", "sold_out", "postponed"]);
const SLOTS_PER_SECTION = 5;

interface HomepageSlotDbRow {
  section: HomepageSection;
  position: number;
  event_id: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function homepageListFrom(now = new Date()): Date {
  return new Date(now.getTime() - HOMEPAGE_LIST_FROM_MS);
}

export function isEventEligibleForHomepage(
  event: { startTs: string; status: string },
  now = new Date()
): boolean {
  if (!SCHEDULED_STATUSES.has(event.status as EventStatus)) {
    return false;
  }
  return new Date(event.startTs).getTime() >= homepageListFrom(now).getTime();
}

export function isSlotStale(
  event: { startTs: string; status: string } | null | undefined,
  now = new Date()
): boolean {
  if (!event) {
    return true;
  }
  return !isEventEligibleForHomepage(event, now);
}

async function loadSlotRows(env: Env): Promise<HomepageSlotDbRow[]> {
  const params = new URLSearchParams({
    select: "section,position,event_id,updated_at,updated_by",
    order: "section.asc,position.asc"
  });
  return supabaseRequest<HomepageSlotDbRow[]>(env, `/rest/v1/homepage_slots?${params}`);
}

function slotMap(rows: HomepageSlotDbRow[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const section of ["featured", "popular"] as const) {
    for (let position = 1; position <= SLOTS_PER_SECTION; position += 1) {
      map.set(`${section}:${position}`, null);
    }
  }
  for (const row of rows) {
    map.set(`${row.section}:${row.position}`, row.event_id);
  }
  return map;
}

async function resolveSection(
  env: Env,
  section: HomepageSection,
  pins: Map<string, string | null>,
  placedIds: Set<string>,
  from: Date
): Promise<HomepageSlotItem[]> {
  const items: HomepageSlotItem[] = [];
  const pinnedIds: Array<string | null> = [];

  for (let position = 1; position <= SLOTS_PER_SECTION; position += 1) {
    pinnedIds.push(pins.get(`${section}:${position}`) ?? null);
  }

  const uniquePinned = [...new Set(pinnedIds.filter((id): id is string => Boolean(id)))];
  const pinnedItems = await listEventsByIds(env, uniquePinned);
  const pinnedById = new Map(pinnedItems.map((item) => [item.event.id, item]));

  for (let position = 1; position <= SLOTS_PER_SECTION; position += 1) {
    const eventId = pinnedIds[position - 1];
    if (eventId) {
      const item = pinnedById.get(eventId);
      if (item && isEventEligibleForHomepage(item.event)) {
        items.push({ position, source: "pinned", item });
        placedIds.add(item.event.id);
      }
    }
  }

  while (items.length < SLOTS_PER_SECTION) {
    const auto = await nextAutoEvent(env, from, placedIds);
    if (!auto) {
      break;
    }
    items.push({ position: items.length + 1, source: "auto", item: auto });
    placedIds.add(auto.event.id);
  }

  return items.map((entry, index) => ({ ...entry, position: index + 1 }));
}

async function nextAutoEvent(
  env: Env,
  from: Date,
  exclude: Set<string>
): Promise<EventListItem | null> {
  const pool = await listEventsFromSupabase(env, { from, limit: 50 });
  for (const item of pool.items) {
    if (!exclude.has(item.event.id) && isEventEligibleForHomepage(item.event)) {
      return item;
    }
  }
  return null;
}

export async function resolveHomepageCuration(env: Env): Promise<HomepageCurationResponse> {
  const now = new Date();
  const from = homepageListFrom(now);
  const rows = await loadSlotRows(env);
  const pins = slotMap(rows);
  const placedIds = new Set<string>();

  const featured = await resolveSection(env, "featured", pins, placedIds, from);
  const popular = await resolveSection(env, "popular", pins, placedIds, from);

  return {
    featured,
    popular,
    generatedAt: now.toISOString()
  };
}

export async function getHomepageSlotsAdmin(env: Env): Promise<HomepageSlotsResponse> {
  const now = new Date();
  const rows = await loadSlotRows(env);
  const pins = slotMap(rows);
  const allIds = [...new Set([...pins.values()].filter((id): id is string => Boolean(id)))];
  const items = await listEventsByIds(env, allIds);
  const byId = new Map(items.map((item) => [item.event.id, item]));

  const slots: HomepageSlotRow[] = [];

  for (const section of ["featured", "popular"] as const) {
    for (let position = 1; position <= SLOTS_PER_SECTION; position += 1) {
      const eventId = pins.get(`${section}:${position}`) ?? null;
      const item = eventId ? byId.get(eventId) : undefined;
      slots.push({
        section,
        position,
        eventId,
        event: item
          ? {
              id: item.event.id,
              slug: item.event.slug,
              title: item.event.title,
              startTs: item.event.startTs,
              status: item.event.status,
              heroImageUrl: item.heroImage?.cdnUrl ?? null
            }
          : null,
        stale: eventId ? isSlotStale(item?.event) : false
      });
    }
  }

  return { slots, generatedAt: now.toISOString() };
}

export async function saveHomepageSlotsAdmin(
  env: Env,
  input: {
    slots: Array<{ section: HomepageSection; position: number; eventId: string | null }>;
    reviewedBy?: string;
  }
): Promise<HomepageSlotsResponse> {
  const seen = new Set<string>();
  for (const slot of input.slots) {
    if (slot.eventId) {
      if (seen.has(slot.eventId)) {
        throw new HomepageCurationError("duplicate_event_in_slots", "The same event cannot appear in multiple slots.", 400);
      }
      seen.add(slot.eventId);
    }
  }

  const from = homepageListFrom();
  for (const slot of input.slots) {
    if (!slot.eventId) {
      continue;
    }
    const items = await listEventsByIds(env, [slot.eventId]);
    const item = items[0];
    if (!item) {
      throw new HomepageCurationError("invalid_event", `Event ${slot.eventId} was not found.`, 400);
    }
    if (!SCHEDULED_STATUSES.has(item.event.status)) {
      throw new HomepageCurationError("invalid_event_status", `Event ${slot.eventId} is not eligible for homepage slots.`, 400);
    }
    if (!isEventEligibleForHomepage(item.event, from)) {
      throw new HomepageCurationError("invalid_event_time", `Event ${slot.eventId} is outside the homepage time window.`, 400);
    }
  }

  const now = new Date().toISOString();
  const reviewedBy = input.reviewedBy ?? "admin";

  for (const slot of input.slots) {
    const params = new URLSearchParams({
      section: `eq.${slot.section}`,
      position: `eq.${slot.position}`
    });
    await supabaseRequest(env, `/rest/v1/homepage_slots?${params}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        event_id: slot.eventId,
        updated_at: now,
        updated_by: reviewedBy
      })
    });
  }

  return getHomepageSlotsAdmin(env);
}

export class HomepageCurationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "HomepageCurationError";
  }
}
