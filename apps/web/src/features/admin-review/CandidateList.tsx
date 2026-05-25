import { Loader2 } from "lucide-react";

import { EventRow } from "@/components/EventRow";
import { SecHead } from "@/components/SecHead";
import { getEventDisplayPriorityLabel } from "@fresno-events/shared";
import { effectivePriority, type PriorityGroup } from "../admin/admin-priority.utils";
import type { CandidateStatusFilter } from "../admin/admin-api";

import { toCandidateEventRowViewModel } from "./admin-candidate.utils";
import styles from "./CandidateList.module.css";

export interface CandidateListProps {
  groups: PriorityGroup[];
  activeId: string | null;
  isLoading: boolean;
  statusFilter: CandidateStatusFilter;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  priorityOverrides: Record<string, number>;
  onToggleSelected: (id: string) => void;
  onSelectAll: () => void;
}

export function CandidateList({
  groups,
  activeId,
  isLoading,
  statusFilter,
  onSelect,
  selectedIds,
  priorityOverrides,
  onToggleSelected,
  onSelectAll
}: CandidateListProps) {
  const items = groups.flatMap((group) => group.items);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} size={18} /> Loading candidates…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        No candidates with status <strong>{statusFilter.replace(/_/g, " ")}</strong>.
      </div>
    );
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className={styles.list} data-admin-list>
      <div className={styles.toolbar}>
        <label className={styles.selectAll}>
          <input type="checkbox" checked={allSelected} onChange={onSelectAll} />
          Select all on page
        </label>
        <span className={styles.count}>{items.length} rows</span>
      </div>

      {groups.map((group) => (
        <section key={group.priority} className={styles.group}>
          <SecHead
            title={`PRIORITY ${group.priority}`}
            script={getEventDisplayPriorityLabel(group.priority).toLowerCase()}
            count={group.items.length}
          />
          <ul className={styles.rows}>
            {group.items.map((candidate) => {
              const priority = effectivePriority(candidate, priorityOverrides);
              const aiSuggested =
                candidate.suggestedPriority !== undefined && priorityOverrides[candidate.id] === undefined;
              const row = toCandidateEventRowViewModel(candidate, priority, { aiSuggested });

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
                    showImage={priority < 5}
                    priceSubLabel="confidence"
                    forceVisible
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
