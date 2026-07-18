export const BULK_REJECT_MAX_IDS = 100;

export function parseBulkRejectIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const ids = raw
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique : null;
}

export function validateBulkRejectIdCount(ids: string[]): string | null {
  if (ids.length > BULK_REJECT_MAX_IDS) {
    return `At most ${BULK_REJECT_MAX_IDS} ids per bulk-reject request.`;
  }
  return null;
}
