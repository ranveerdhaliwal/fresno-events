import { EVENT_PRIORITY_DEFAULT, type EventCandidate } from "@fresno-events/shared";

const PRIORITY_STORAGE_KEY = "wuf:admin_priority";

export function readPriorityOverrides(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(PRIORITY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5) {
        out[id] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writePriorityOverrides(overrides: Record<string, number>) {
  try {
    sessionStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function clearPriorityOverride(id: string, overrides: Record<string, number>): Record<string, number> {
  const next = { ...overrides };
  delete next[id];
  writePriorityOverrides(next);
  return next;
}

export function suggestedPriorityFor(candidate: EventCandidate): number {
  return candidate.suggestedPriority ?? EVENT_PRIORITY_DEFAULT;
}

export function effectivePriority(
  candidate: EventCandidate,
  overrides: Record<string, number>
): number {
  return overrides[candidate.id] ?? suggestedPriorityFor(candidate);
}

export function sortCandidatesForReview(
  items: EventCandidate[],
  overrides: Record<string, number>
): EventCandidate[] {
  return [...items].sort((a, b) => {
    const pa = effectivePriority(a, overrides);
    const pb = effectivePriority(b, overrides);
    if (pa !== pb) {
      return pa - pb;
    }
    return b.confidenceScore - a.confidenceScore;
  });
}

export interface PriorityGroup {
  priority: number;
  items: EventCandidate[];
}

export function groupCandidatesByPriority(
  sorted: EventCandidate[],
  overrides: Record<string, number>
): PriorityGroup[] {
  const groups: PriorityGroup[] = [];
  for (const item of sorted) {
    const p = effectivePriority(item, overrides);
    const last = groups[groups.length - 1];
    if (last && last.priority === p) {
      last.items.push(item);
    } else {
      groups.push({ priority: p, items: [item] });
    }
  }
  return groups;
}
