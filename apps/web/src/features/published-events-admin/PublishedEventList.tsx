import { AdminEventRow } from "@/components/AdminEventRow";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { SecHead } from "@/components/SecHead";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { getEventDisplayPriorityLabel } from "@fresno-events/shared";
import { isPageFullySelected } from "../admin-review/admin-review-selection.utils";
import listStyles from "../admin-review/CandidateList.module.css";

import { toPublishedEventRowViewModel, type PublishedPriorityGroup } from "./published-events-admin.utils";

export interface PublishedEventListProps {
  groups: PublishedPriorityGroup[];
  activeId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  searchMode?: boolean;
  searchQuery?: string;
}

export function PublishedEventList({
  groups,
  activeId,
  isLoading,
  onSelect,
  selectedIds,
  onToggleSelected,
  onSelectAll,
  searchMode = false,
  searchQuery = ""
}: PublishedEventListProps) {
  const items = groups.flatMap((group) => group.items);

  if (isLoading) {
    return (
      <div className={listStyles.loading} data-testid="published-event-list-skeleton" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <EventRowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={listStyles.empty}>
        {searchMode ? (
          <>
            No published events match <strong>{searchQuery.trim()}</strong>.
          </>
        ) : (
          <>No published events in this range.</>
        )}
      </div>
    );
  }

  const allSelected = isPageFullySelected(
    selectedIds,
    items.map((item) => item.id)
  );

  return (
    <div className={listStyles.list} data-admin-list>
      <div className={listStyles.toolbar}>
        <label className={listStyles.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onSelectAll(items.map((item) => item.id))}
          />
          Select all on page
        </label>
        <span className={listStyles.count}>{items.length} rows</span>
      </div>

      {groups.map((group, groupIndex) => (
        <section key={`${group.priority}-${groupIndex}`} className={listStyles.group}>
          <SecHead
            title={searchMode ? `SEARCH · PRIORITY ${group.priority}` : `PRIORITY ${group.priority}`}
            script={getEventDisplayPriorityLabel(group.priority).toLowerCase()}
            count={group.items.length}
          />
          <ul className={listStyles.rows}>
            {group.items.map((hit) => {
              const row = toPublishedEventRowViewModel(hit);
              const showImage = hit.priority < 5;

              return (
                <li key={hit.id} className={listStyles.item}>
                  <input
                    type="checkbox"
                    className={listStyles.checkbox}
                    checked={selectedIds.has(hit.id)}
                    onChange={() => onToggleSelected(hit.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${hit.title}`}
                  />
                  <AdminEventRow
                    event={row}
                    isSelected={hit.id === activeId}
                    onSelect={() => onSelect(hit.id)}
                    showImage={showImage}
                    priorityLabel={`P${hit.priority} · ${getEventDisplayPriorityLabel(hit.priority)}`}
                    priceSubLabel="status"
                    forceVisible
                    adminAction={<AdminEditLink eventId={hit.id} />}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
