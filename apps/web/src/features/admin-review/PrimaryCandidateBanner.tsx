import { Link2 } from "lucide-react";
import { memo } from "react";

import type { LinkedEventCandidate } from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { formatCandidateSourceGroupLabel } from "@/features/admin/admin-priority.utils";

import styles from "./PrimaryCandidateBanner.module.css";

export const PrimaryCandidateBanner = memo(function PrimaryCandidateBanner({
  primaryCandidate,
  onOpenPrimary
}: {
  primaryCandidate: LinkedEventCandidate;
  onOpenPrimary: (id: string) => void;
}) {
  const sourceLabel = formatCandidateSourceGroupLabel(primaryCandidate.source);
  const statusLabel = primaryCandidate.status.replace(/_/g, " ");

  return (
    <div className={styles.banner} role="status">
      <div className={styles.copy}>
        <p className={styles.title}>
          <Link2 className={styles.icon} aria-hidden />
          Linked to another source
        </p>
        <p className={styles.body}>
          Approve or publish updates on the <strong>primary</strong> row (
          <span className={styles.source}>{sourceLabel}</span>
          {statusLabel ? ` · ${statusLabel}` : ""}), not this linked listing.
        </p>
        <p className={styles.primaryTitle}>{primaryCandidate.title}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => onOpenPrimary(primaryCandidate.id)}>
        Open primary row
      </Button>
    </div>
  );
});
