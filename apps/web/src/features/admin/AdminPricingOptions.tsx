import { cn } from "@/lib/cn";

import type { AdminEventFormState } from "./admin-form.types";
import { applyAdminIsFreeChange } from "./admin-form.utils";

import styles from "./AdminPricingOptions.module.css";

export interface AdminPricingOptionsProps {
  draft: AdminEventFormState;
  onChange: (next: AdminEventFormState) => void;
  highlightChanged?: boolean;
}

export function AdminPricingOptions({
  draft,
  onChange,
  highlightChanged = false
}: AdminPricingOptionsProps) {
  return (
    <div
      className={cn(styles.root, highlightChanged && styles.rootChanged)}
      role="group"
      aria-label="Pricing options"
    >
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={draft.isFree}
          onChange={(event) => onChange(applyAdminIsFreeChange(draft, event.target.checked))}
        />
        Free event
      </label>
      <p className={styles.hint}>
        Check for no-cost events (shows Free on the site). Or enter min/max for dollar amounts. When
        price is unknown but a ticket URL is set, the list shows See Tickets for price (smaller type) and
        the detail page says See tickets for price.
      </p>
    </div>
  );
}
