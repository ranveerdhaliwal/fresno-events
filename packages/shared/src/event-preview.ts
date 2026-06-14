export interface PreviewCaps {
  maxP3?: number;
  maxP4?: number;
  maxP5?: number;
}

export interface EventPreviewSortable {
  event: {
    id: string;
    priority: number;
    startTs: string;
  };
}

export function compareEventsByPriorityStart<T extends EventPreviewSortable>(a: T, b: T): number {
  if (a.event.priority !== b.event.priority) {
    return a.event.priority - b.event.priority;
  }
  return new Date(a.event.startTs).getTime() - new Date(b.event.startTs).getTime();
}

export function selectEventPreview<T extends EventPreviewSortable>(
  items: T[],
  caps: PreviewCaps = {}
): { preview: T[]; total: number; hidden: number } {
  const maxP3 = caps.maxP3 ?? 3;
  const maxP4 = caps.maxP4 ?? 2;
  const maxP5 = caps.maxP5 ?? 1;

  const sorted = [...items].sort(compareEventsByPriorityStart);
  const preview: T[] = [];
  let countP3 = 0;
  let countP4 = 0;
  let countP5 = 0;

  for (const item of sorted) {
    const priority = item.event.priority;
    if (priority <= 2) {
      preview.push(item);
      continue;
    }
    if (priority === 3 && countP3 < maxP3) {
      preview.push(item);
      countP3 += 1;
      continue;
    }
    if (priority === 4 && countP4 < maxP4) {
      preview.push(item);
      countP4 += 1;
      continue;
    }
    if (priority >= 5 && countP5 < maxP5) {
      preview.push(item);
      countP5 += 1;
    }
  }

  return {
    preview,
    total: sorted.length,
    hidden: Math.max(0, sorted.length - preview.length)
  };
}
