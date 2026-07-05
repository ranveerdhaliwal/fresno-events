import { memo } from "react";

import { EventRow } from "@/components/EventRow";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { SecHead } from "@/components/SecHead";
import { getEventDisplayPriorityLabel } from "@fresno-events/shared";
import { listDisplayPriority, type CandidateListGroup } from "../admin/admin-priority.utils";
import type { CandidateStatusFilter } from "../admin/admin-api";

import { toCandidateEventRowViewModel } from "./admin-candidate.utils";
import { isPageFullySelected } from "./admin-review-selection.utils";
import styles from "./CandidateList.module.css";

export interface CandidateListProps {
  groups: CandidateListGroup[];
  activeId: string | null;
  isLoading: boolean;
  statusFilter: CandidateStatusFilter;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  priorityOverrides: Record<string, number>;
  seriesDisplayPriorities: Map<string, number>;
  usePublishedPriority?: boolean;
  onToggleSelected: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  searchMode?: boolean;
  searchQuery?: string;
}

export const CandidateList = memo(function CandidateList({
  groups,
  activeId,
  isLoading,
  statusFilter,
  onSelect,
  selectedIds,
  priorityOverrides,
  seriesDisplayPriorities,
  usePublishedPriority = false,
  onToggleSelected,
  onSelectAll,
  searchMode = false,
  searchQuery = ""
}: CandidateListProps) {
  const items = groups.flatMap((group) => group.items);

  if (isLoading) {
    return (
      <div className={styles.loading} data-testid="candidate-list-skeleton" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <EventRowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        {searchMode ? (
          <>
            No candidates match <strong>{searchQuery.trim()}</strong>.
          </>
        ) : (
          <>
            No candidates with status <strong>{statusFilter.replace(/_/g, " ")}</strong>.
          </>
        )}
      </div>
    );
  }

  const allSelected = isPageFullySelected(selectedIds, items.map((item) => item.id));

  return (
    <div className={styles.list} data-admin-list>
      <div className={styles.toolbar}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onSelectAll(items.map((item) => item.id))}
          />
          Select all on page
        </label>
        <span className={styles.count}>{items.length} rows</span>
      </div>

      {groups.map((group, groupIndex) => {
        const groupIds = group.items.map((item) => item.id);
        const groupAllSelected = isPageFullySelected(selectedIds, groupIds);

        return (
        <section key={`${group.source || "all"}-${groupIndex}`} className={styles.group}>
          {group.label ? (
            <SecHead
              title={searchMode ? `SEARCH · ${group.label}` : group.label}
              count={group.items.length}
              groupSelectAll={{
                checked: groupAllSelected,
                onChange: () => onSelectAll(groupIds)
              }}
            />
          ) : null}
          <ul className={styles.rows}>
            {group.items.map((candidate) => {
              const priority = listDisplayPriority(
                candidate,
                seriesDisplayPriorities,
                priorityOverrides,
                usePublishedPriority
              );
              const row = toCandidateEventRowViewModel(candidate, priority, {
                showStatusInLabel: searchMode
              });
              const showP5ListImage = priority === 5 && row.showVenueLogoInList !== true;

              return (
                <li key={candidate.id} className={styles.item}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedIds.has(candidate.id)}
                    onChange={() => onToggleSelected(candidate.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${candidate.title}`}
                  />
                  <EventRow
                    event={row}
                    isSelected={candidate.id === activeId}
                    onSelect={() => onSelect(candidate.id)}
                    showImage
                    showP5ListImage={showP5ListImage}
                    priorityLabel={`P${priority} · ${getEventDisplayPriorityLabel(priority)}`}
                    priceSubLabel="confidence"
                    forceVisible
                  />
                </li>
              );
            })}
          </ul>
        </section>
        );
      })}
    </div>
  );
});
