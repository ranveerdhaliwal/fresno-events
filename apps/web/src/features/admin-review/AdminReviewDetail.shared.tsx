import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { AdminApiError, type CandidateStatusFilter } from "../admin/admin-api";

import styles from "./AdminReviewWorkspace.module.css";

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

export function DetailLoading() {
  return (
    <div className={styles.detailPanePlaceholder}>
      <Loader2 className="size-4 animate-spin" />
      <span>Loading candidate...</span>
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const message = error instanceof AdminApiError
    ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

  return (
    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <div className="flex items-center gap-2 text-rose-200">
        <ShieldAlert className="size-4" />
        <span className="font-medium">Request failed</span>
      </div>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs uppercase tracking-[0.18em] text-neutral-400">
      <span>{label}</span>
      <div className="normal-case tracking-normal text-neutral-100">{children}</div>
    </label>
  );
}
