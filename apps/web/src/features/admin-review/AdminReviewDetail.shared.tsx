import { ShieldAlert } from "lucide-react";

import { FormField } from "@/components/FormField/FormField";
import type { CandidateStatusFilter } from "../admin/admin-api";

import styles from "./AdminReviewWorkspace.module.css";

export { DetailLoading } from "@/components/DetailLoading";
export { ErrorBanner } from "@/components/ErrorBanner";
export { FormField as Field };

export function EmptyDetail({ statusFilter }: { statusFilter: CandidateStatusFilter }) {
  const label =
    statusFilter === "pending_review"
      ? "New"
      : statusFilter === "needs_changes"
        ? "Updates"
        : statusFilter.replace(/_/g, " ");

  return (
    <div className={styles.detailPanePlaceholder}>
      <ShieldAlert className="size-6" />
      <p>
        Select a candidate from the list to review. Currently showing the{" "}
        <span className="font-medium">{label}</span> queue.
      </p>
    </div>
  );
}
