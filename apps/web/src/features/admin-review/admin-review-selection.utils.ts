/** Toggle bulk selection for the visible page only (search-filtered rows). */
export function togglePageSelection(selectedIds: Set<string>, pageIds: string[]): Set<string> {
  const allVisibleSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  if (allVisibleSelected) {
    const next = new Set(selectedIds);
    for (const id of pageIds) {
      next.delete(id);
    }
    return next;
  }
  return new Set([...selectedIds, ...pageIds]);
}

/** Whether every visible row on the page is selected. */
export function isPageFullySelected(selectedIds: Set<string>, pageIds: string[]): boolean {
  return pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
}
