import { CheckCircle2, ChevronDown, ChevronUp, Link2, Loader2, MapPin, ShieldAlert, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  ReviewOccurrenceRelinkOpsResponse,
  ReviewPriorityRerankOpsResponse,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueGeocodeOpsResponse
} from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { Text } from "@/components/Text";

import {
  normalizeOccurrenceRelinkSummary,
  normalizePriorityRuleGroups
} from "./admin-maintenance.utils";
import styles from "./AdminMaintenancePanel.module.css";

export type MaintenanceOpKind = "relink" | "addresses" | "priority" | "geocode";

export interface MaintenanceOpResult {
  kind: MaintenanceOpKind;
  dryRun: boolean;
  relink?: ReviewOccurrenceRelinkOpsResponse;
  addresses?: ReviewVenueAddressBackfillOpsResponse;
  priority?: ReviewPriorityRerankOpsResponse;
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
    title: "Priority rerank",
    description:
      "Apply shared priority rules to pending primaries and published events (venue defaults, recurring demotions, marquee draws). CLI: pnpm priority:rerank.",
    icon: Sparkles,
    applyLabel: "Apply",
    requiresIngest: false
  },
  {
    kind: "geocode",
    title: "Geocode venues",
    description:
      "Fill missing lat/lng on venue rows and review candidates that have a street address. Apply runs all batches until done.",
    icon: MapPin,
    applyLabel: "Geocode",
    requiresIngest: false
  }
];

const MAINTENANCE_COLLAPSED_KEY = "wuf:admin_maintenance_collapsed";

function readCollapsedPreference(): boolean {
  if (typeof sessionStorage === "undefined") {
    return true;
  }
  const stored = sessionStorage.getItem(MAINTENANCE_COLLAPSED_KEY);
  return stored === null ? true : stored === "1";
}

export interface AdminMaintenancePanelProps {
  activeOp: MaintenanceOpKind | null;
  isLoading: boolean;
  result: MaintenanceOpResult | null;
  progressMessage?: string | null;
  onCheck: (kind: MaintenanceOpKind) => void;
  onApply: (kind: MaintenanceOpKind) => void;
  onDismiss: () => void;
}

function isCleanCheck(result: MaintenanceOpResult): boolean {
  if (result.error || !result.dryRun) {
    return false;
  }
  if (result.kind === "relink" && result.relink) {
    const summary = normalizeOccurrenceRelinkSummary(result.relink.summary);
    return summary.changed === 0 && summary.errors === 0;
  }
  if (result.kind === "addresses" && result.addresses) {
    return (
      result.addresses.summary.candidateUpdates === 0 &&
      result.addresses.summary.venueUpdates === 0 &&
      result.addresses.summary.errors === 0
    );
  }
  if (result.kind === "priority" && result.priority) {
    const c = result.priority.candidates.summary;
    const e = result.priority.events.summary;
    return (
      c.wouldChange === 0 && e.wouldChange === 0 && c.errors === 0 && e.errors === 0
    );
  }
  if (result.kind === "geocode" && result.geocode) {
    const s = result.geocode.summary;
    if (result.dryRun) {
      return s.scanned === 0 && s.errors === 0;
    }
    return (s.remaining ?? 0) === 0 && s.errors === 0;
  }
  return false;
}

function resultTitle(
  result: MaintenanceOpResult | null,
  isLoading: boolean,
  activeOp: MaintenanceOpKind | null,
  progressMessage?: string | null
): string {
  if (isLoading && activeOp) {
    if (activeOp === "geocode" && progressMessage) {
      return progressMessage;
    }
    const op = OPS.find((item) => item.kind === activeOp);
    const verb = activeOp === "geocode" ? "Geocoding" : "Checking";
    return `${verb} ${op?.title.toLowerCase() ?? "maintenance"}…`;
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
    const s = normalizeOccurrenceRelinkSummary(result.relink.summary);
    const linkExamples = s.linkExamples;
    return (
      <>
        <div className={styles.stats}>
          <Stat label={result.dryRun ? "Rows to update" : "Rows updated"} value={s.changed} />
          <Stat
            label={result.dryRun ? "Link groups" : "Link groups touched"}
            value={result.dryRun ? s.linkGroupsChanged : s.linkGroups}
          />
        </div>
        {linkExamples.length > 0 ? (
          <ul className={styles.sampleList}>
            {linkExamples.map((example) => (
              <li key={`${example.title}-${example.primarySource}`}>
                <Text variant="body3" tone="onCard">
                  <strong>{example.title}</strong> — {example.primarySource} +{" "}
                  {example.linkedSources.join(", ")}
                  {example.crossSource ? " · cross-source" : ""}
                </Text>
              </li>
            ))}
          </ul>
        ) : null}
        <Text as="p" variant="body3" tone="onCard" className={styles.message}>
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
          {result.dryRun ? (
            <>
              <Stat label="Scanned" value={s.scanned} />
              <Stat label="Venues" value={s.venueScanned} />
              <Stat label="Candidates" value={s.candidateScanned} />
              <Stat label="Would geocode" value={s.geocoded} />
            </>
          ) : (
            <>
              <Stat label="Geocoded" value={s.geocoded} />
              <Stat label="Batches" value={s.batchesRun ?? 1} />
              <Stat label="Candidates" value={s.candidateGeocoded} />
              <Stat label="Remaining" value={s.remaining ?? 0} />
              <Stat label="Skipped" value={s.skipped} />
              <Stat label="Errors" value={s.errors} />
            </>
          )}
        </div>
        <Text as="pre" variant="body3" tone="onCard" className={styles.message}>
          {result.geocode.message}
        </Text>
      </>
    );
  }

  if (result.priority) {
    const c = result.priority.candidates;
    const e = result.priority.events;
    const candidateRules = normalizePriorityRuleGroups(c.byRule);
    const eventRules = normalizePriorityRuleGroups(e.byRule);
    const allRules = [...candidateRules, ...eventRules];
    const totalWouldChange = c.summary.wouldChange + e.summary.wouldChange;
    const totalApplied = c.summary.applied + e.summary.applied;
    const totalScanned = c.summary.scanned + e.summary.scanned;
    const ruleCount = allRules.length;

    return (
      <>
        <div className={styles.stats}>
          <Stat label="Scanned" value={totalScanned} />
          <Stat
            label={result.dryRun ? "Would change" : "Updated"}
            value={result.dryRun ? totalWouldChange : totalApplied}
          />
          <Stat label="Rules matched" value={ruleCount} />
        </div>
        <div className={styles.stats}>
          <Stat label="Candidates scanned" value={c.summary.scanned} />
          <Stat
            label={result.dryRun ? "Candidates to change" : "Candidates updated"}
            value={result.dryRun ? c.summary.wouldChange : c.summary.applied}
          />
          <Stat label="Events scanned" value={e.summary.scanned} />
          <Stat
            label={result.dryRun ? "Events to change" : "Events updated"}
            value={result.dryRun ? e.summary.wouldChange : e.summary.applied}
          />
        </div>
        {allRules.length > 0 ? (
          <ul className={styles.ruleList}>
            {allRules.map((group) => (
              <li key={`${group.ruleLabel}-${group.toPriority}`} className={styles.ruleItem}>
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
        <Text as="pre" variant="body3" tone="onCard" className={styles.message}>
          {result.priority.message}
        </Text>
      </>
    );
  }

  return null;
}

export function AdminMaintenancePanel({
  activeOp,
  isLoading,
  result,
  progressMessage,
  onCheck,
  onApply,
  onDismiss
}: AdminMaintenancePanelProps) {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const showResult = isLoading || result !== null;

  useEffect(() => {
    sessionStorage.setItem(MAINTENANCE_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <section className={styles.panel} aria-label="Queue maintenance">
      <div className={styles.header}>
        <div className={styles.intro}>
          <Text variant="body2" tone="onCard" className={styles.introTitle}>
            Queue maintenance
          </Text>
          {!collapsed ? (
            <Text variant="body3" tone="mutedOnCard">
              Preview is read-only. Apply writes to the database. Relink and addresses need{" "}
              <Text as="code" variant="body3" tone="labelOnCard" className={styles.code}>
                pnpm ingest:dev
              </Text>
              .
            </Text>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand queue maintenance" : "Collapse queue maintenance"}
        >
          {collapsed ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
        </button>
      </div>

      {!collapsed ? (
        <>
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
                {resultTitle(result, isLoading, activeOp, progressMessage)}
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
        </>
      ) : null}
    </section>
  );
}
