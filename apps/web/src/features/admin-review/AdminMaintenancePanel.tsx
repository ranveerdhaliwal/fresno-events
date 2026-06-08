import { CheckCircle2, Link2, Loader2, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  ReviewOccurrenceRelinkOpsResponse,
  ReviewPriorityTriageOpsResponse,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueGeocodeOpsResponse
} from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { Text } from "@/components/Text";

import styles from "./AdminMaintenancePanel.module.css";

export type MaintenanceOpKind = "relink" | "addresses" | "priority" | "geocode";

export interface MaintenanceOpResult {
  kind: MaintenanceOpKind;
  dryRun: boolean;
  relink?: ReviewOccurrenceRelinkOpsResponse;
  addresses?: ReviewVenueAddressBackfillOpsResponse;
  priority?: ReviewPriorityTriageOpsResponse;
  geocode?: ReviewVenueGeocodeOpsResponse;
  error?: string;
}

interface MaintenanceOpConfig {
  kind: MaintenanceOpKind;
  title: string;
  description: string;
  icon: LucideIcon;
  applyLabel: string;
  requiresIngest: boolean;
}

const OPS: MaintenanceOpConfig[] = [
  {
    kind: "relink",
    title: "Occurrence relink",
    description: "Recompute show-night keys and cross-source duplicate links.",
    icon: Link2,
    applyLabel: "Run",
    requiresIngest: true
  },
  {
    kind: "addresses",
    title: "Venue addresses",
    description: "Strip city/state from mailing-line addresses on candidates and venues.",
    icon: MapPin,
    applyLabel: "Fix",
    requiresIngest: true
  },
  {
    kind: "priority",
    title: "Priority triage",
    description: "Apply editorial rules to pending primaries (e.g. demote flea market).",
    icon: Sparkles,
    applyLabel: "Apply",
    requiresIngest: false
  },
  {
    kind: "geocode",
    title: "Geocode venues",
    description: "Fill missing lat/lng on venues that have a street address (Nominatim, rate-limited).",
    icon: MapPin,
    applyLabel: "Geocode",
    requiresIngest: false
  }
];

export interface AdminMaintenancePanelProps {
  activeOp: MaintenanceOpKind | null;
  isLoading: boolean;
  result: MaintenanceOpResult | null;
  onCheck: (kind: MaintenanceOpKind) => void;
  onApply: (kind: MaintenanceOpKind) => void;
  onDismiss: () => void;
}

function isCleanCheck(result: MaintenanceOpResult): boolean {
  if (result.error || !result.dryRun) {
    return false;
  }
  if (result.kind === "relink" && result.relink) {
    return result.relink.summary.changed === 0 && result.relink.summary.errors === 0;
  }
  if (result.kind === "addresses" && result.addresses) {
    return (
      result.addresses.summary.candidateUpdates === 0 &&
      result.addresses.summary.venueUpdates === 0 &&
      result.addresses.summary.errors === 0
    );
  }
  if (result.kind === "priority" && result.priority) {
    return result.priority.summary.wouldChange === 0 && result.priority.summary.errors === 0;
  }
  if (result.kind === "geocode" && result.geocode) {
    return result.geocode.summary.geocoded === 0 && result.geocode.summary.errors === 0;
  }
  return false;
}

function resultTitle(result: MaintenanceOpResult | null, isLoading: boolean, activeOp: MaintenanceOpKind | null): string {
  if (isLoading && activeOp) {
    const op = OPS.find((item) => item.kind === activeOp);
    return `Checking ${op?.title.toLowerCase() ?? "maintenance"}…`;
  }
  if (!result) {
    return "";
  }
  if (result.error) {
    return "Something went wrong";
  }
  const op = OPS.find((item) => item.kind === result.kind);
  const verb = result.dryRun ? "Preview" : op?.applyLabel === "Fix" ? "Fixed" : "Applied";
  return `${op?.title ?? "Maintenance"} — ${verb}`;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.stat}>
      <Text variant="body1" tone="onCard" className={styles.statValue}>
        {value}
      </Text>
      <Text variant="body3" tone="labelOnCard">
        {label}
      </Text>
    </div>
  );
}

function ResultBody({ result }: { result: MaintenanceOpResult }) {
  if (result.error) {
    return (
      <Text variant="body2" tone="onCard">
        {result.error}
      </Text>
    );
  }

  if (result.relink) {
    const s = result.relink.summary;
    return (
      <>
        <div className={styles.stats}>
          <Stat label="Candidates" value={s.candidates} />
          <Stat label={result.dryRun ? "Would update" : "Updated"} value={s.changed} />
          <Stat label="Cross-source" value={s.multiSourceGroups} />
          <Stat label="Duplicates linked" value={s.linkedAsDuplicate} />
        </div>
        <Text as="pre" variant="body3" tone="onCard" className={styles.message}>
          {result.relink.message}
        </Text>
      </>
    );
  }

  if (result.addresses) {
    const s = result.addresses.summary;
    return (
      <>
        <div className={styles.stats}>
          <Stat label="Scanned" value={s.scanned} />
          <Stat label={result.dryRun ? "Candidates to fix" : "Candidates fixed"} value={s.candidateUpdates} />
          <Stat label={result.dryRun ? "Venues to fix" : "Venues fixed"} value={s.venueUpdates} />
        </div>
        <Text as="pre" variant="body3" tone="onCard" className={styles.message}>
          {result.addresses.message}
        </Text>
      </>
    );
  }

  if (result.geocode) {
    const s = result.geocode.summary;
    return (
      <>
        <div className={styles.stats}>
          <Stat label="Scanned" value={s.scanned} />
          <Stat label={result.dryRun ? "Would geocode" : "Geocoded"} value={s.geocoded} />
          <Stat label="Skipped" value={s.skipped} />
          <Stat label="Errors" value={s.errors} />
        </div>
        <Text as="pre" variant="body3" tone="onCard" className={styles.message}>
          {result.geocode.message}
        </Text>
      </>
    );
  }

  if (result.priority) {
    const s = result.priority.summary;
    return (
      <>
        <div className={styles.stats}>
          <Stat label="Scanned" value={s.scanned} />
          <Stat label={result.dryRun ? "Would change" : "Updated"} value={result.dryRun ? s.wouldChange : s.applied} />
          <Stat label="Rules matched" value={result.priority.byRule.length} />
        </div>
        {result.priority.byRule.length > 0 ? (
          <ul className={styles.ruleList}>
            {result.priority.byRule.map((group) => (
              <li key={group.ruleLabel} className={styles.ruleItem}>
                <div className={styles.ruleHeader}>
                  <Text variant="body2" tone="onCard">
                    {group.ruleLabel}
                  </Text>
                  <Text variant="body3" tone="labelOnCard" className={styles.ruleMeta}>
                    → P{group.toPriority} · {group.count}
                  </Text>
                </div>
                {group.samples.length > 0 ? (
                  <ul className={styles.sampleList}>
                    {group.samples.map((sample) => (
                      <li key={sample}>
                        <Text variant="body3" tone="mutedOnCard">
                          {sample}
                        </Text>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Text variant="body2" tone="mutedOnCard">
            No rule matched a different priority.
          </Text>
        )}
      </>
    );
  }

  return null;
}

export function AdminMaintenancePanel({
  activeOp,
  isLoading,
  result,
  onCheck,
  onApply,
  onDismiss
}: AdminMaintenancePanelProps) {
  const showResult = isLoading || result !== null;

  return (
    <section className={styles.panel} aria-label="Queue maintenance">
      <div className={styles.intro}>
        <Text variant="body2" tone="onCard" className={styles.introTitle}>
          Queue maintenance
        </Text>
        <Text variant="body3" tone="mutedOnCard">
          Preview is read-only. Apply writes to the database. Relink and addresses need{" "}
          <Text as="code" variant="body3" tone="labelOnCard" className={styles.code}>
            pnpm ingest:dev
          </Text>
          .
        </Text>
      </div>

      <div className={styles.opGrid}>
        {OPS.map((op) => {
          const Icon = op.icon;
          const busy = isLoading && activeOp === op.kind;
          return (
            <article key={op.kind} className={styles.opCard}>
              <div className={styles.opHeader}>
                <Text as="span" variant="body3" tone="labelOnCard" className={styles.opIcon}>
                  <Icon size={16} aria-hidden />
                </Text>
                <div>
                  <Text variant="body2" tone="onCard" className={styles.opTitle}>
                    {op.title}
                  </Text>
                  <Text variant="body3" tone="mutedOnCard" className={styles.opDescription}>
                    {op.description}
                  </Text>
                </div>
              </div>
              <div className={styles.opActions}>
                <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => onCheck(op.kind)}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  Preview
                </Button>
                <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => onApply(op.kind)}>
                  {op.applyLabel}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {showResult ? (
        <div className={styles.result} aria-live="polite">
          <div className={styles.resultHeader}>
            <div className={styles.resultTitleRow}>
              {isLoading ? (
                <Text as="span" variant="body2" tone="labelOnCard" className={styles.statusIcon}>
                  <Loader2 className={styles.spin} size={18} aria-hidden />
                </Text>
              ) : result && isCleanCheck(result) ? (
                <Text as="span" variant="body2" tone="labelOnCard" className={styles.statusIcon}>
                  <CheckCircle2 size={18} aria-hidden />
                </Text>
              ) : (
                <Text as="span" variant="body2" tone="labelOnCard" className={styles.statusIcon}>
                  <ShieldAlert size={18} aria-hidden />
                </Text>
              )}
              <Text variant="body2" tone="onCard" className={styles.resultTitle}>
                {resultTitle(result, isLoading, activeOp)}
              </Text>
            </div>
            {result && !isLoading ? (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            ) : null}
          </div>
          {result ? <ResultBody result={result} /> : null}
          {result && !isLoading && !result.error && result.dryRun && !isCleanCheck(result) ? (
            <Text variant="body3" tone="mutedOnCard" className={styles.resultHint}>
              Looks good to apply? Use the Apply / Run / Fix button on that card. Ingest worker logs have full detail.
            </Text>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
