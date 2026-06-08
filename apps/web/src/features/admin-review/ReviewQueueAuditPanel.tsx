import { CheckCircle2, ClipboardCopy, Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useState } from "react";

import type { ReviewQueueAuditIssue, ReviewQueueAuditResponse } from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { Text } from "@/components/Text";

import styles from "./ReviewQueueAuditPanel.module.css";

function formatAuditForClipboard(audit: ReviewQueueAuditResponse): string {
  const lines = [
    "# Pre-approve audit",
    "",
    `Pending primaries: ${audit.summary.pendingPrimaries}`,
    `Scheduled events: ${audit.summary.scheduledEvents}`,
    `Errors: ${audit.summary.errors}`,
    `Warnings: ${audit.summary.warnings}`,
    `Generated: ${audit.generatedAt}`,
    ""
  ];

  if (audit.issues.length === 0) {
    lines.push("No blocking issues found.");
    return lines.join("\n");
  }

  lines.push("## Issues", "");
  for (const issue of audit.issues) {
    lines.push(`### [${issue.severity}] ${issue.code}`);
    lines.push(`- candidate: ${issue.candidateId}`);
    lines.push(`- title: ${issue.title}`);
    lines.push(`- ${issue.message}`);
    if (issue.detail) {
      for (const [key, value] of Object.entries(issue.detail)) {
        lines.push(`- ${key}: ${value}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function IssueRow({ issue }: { issue: ReviewQueueAuditIssue }) {
  return (
    <li className={styles.issue} data-severity={issue.severity}>
      <div className={styles.issueHeader}>
        <span className={styles.issueCode}>{issue.code}</span>
        <span className={styles.issueId}>{issue.candidateId}</span>
      </div>
      <p className={styles.issueTitle}>{issue.title}</p>
      <p className={styles.issueMessage}>{issue.message}</p>
    </li>
  );
}

export interface ReviewQueueAuditPanelProps {
  audit: ReviewQueueAuditResponse | null;
  isLoading: boolean;
  error: string | null;
  onDismiss: () => void;
}

export function ReviewQueueAuditPanel({
  audit,
  isLoading,
  error,
  onDismiss
}: ReviewQueueAuditPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!audit) {
      return;
    }
    await navigator.clipboard.writeText(formatAuditForClipboard(audit));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [audit]);

  if (!isLoading && !audit && !error) {
    return null;
  }

  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleRow}>
          {isLoading ? (
            <Loader2 className={`${styles.icon} ${styles.spin}`} size={18} aria-hidden />
          ) : audit && audit.summary.errors === 0 ? (
            <CheckCircle2 className={styles.iconOk} size={18} aria-hidden />
          ) : (
            <ShieldAlert className={styles.iconWarn} size={18} aria-hidden />
          )}
          <Text variant="body1" tone="onCard" className={styles.panelTitle}>
            Pre-approve check
          </Text>
        </div>
        <div className={styles.panelActions}>
          {audit ? (
            <Button variant="ghost" size="sm" onClick={() => void handleCopy()}>
              <ClipboardCopy className="size-3.5" aria-hidden />
              {copied ? "Copied" : "Copy for Cursor"}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Text variant="body2" tone="mutedOnCard" className={styles.summary}>
          Scanning pending queue for slug conflicts, duplicate links, and Ticketmaster enrichment gaps…
        </Text>
      ) : null}

      {error ? (
        <Text variant="body2" tone="onCard" className={styles.error}>
          {error}
        </Text>
      ) : null}

      {audit ? (
        <>
          <Text variant="body2" tone="mutedOnCard" className={styles.summary}>
            {audit.summary.pendingPrimaries} pending primaries · {audit.summary.scheduledEvents} scheduled
            events ·{" "}
            <strong>{audit.summary.errors === 0 ? "ready to approve" : `${audit.summary.errors} blocking`}</strong>
            {audit.summary.warnings > 0 ? ` · ${audit.summary.warnings} warning(s)` : ""}
          </Text>

          {audit.issues.length > 0 ? (
            <ul className={styles.issueList}>
              {audit.issues.map((issue) => (
                <IssueRow key={`${issue.code}-${issue.candidateId}`} issue={issue} />
              ))}
            </ul>
          ) : (
            <Text variant="body2" tone="onCard" className={styles.ok}>
              No slug collisions, duplicate-link problems, or shared-occurrence primaries detected.
            </Text>
          )}
        </>
      ) : null}
    </section>
  );
}
