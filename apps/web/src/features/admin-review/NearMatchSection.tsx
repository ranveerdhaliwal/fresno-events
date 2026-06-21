import { memo } from "react";
import { ExternalLink } from "lucide-react";

import type { NearMatchCandidate } from "@fresno-events/shared";

import styles from "./NearMatchSection.module.css";

export const NearMatchSection = memo(function NearMatchSection({
  nearMatchCandidates,
  onSelectCandidate
}: {
  nearMatchCandidates: NearMatchCandidate[];
  onSelectCandidate: (id: string) => void;
}) {
  if (nearMatchCandidates.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="Possibly the same show">
      <div className={styles.header}>
        <h3 className={styles.heading}>Possibly the same show</h3>
        <p className={styles.hint}>
          Same venue and night, overlapping title words — not linked as a duplicate yet.
        </p>
      </div>
      <ul className={styles.list}>
        {nearMatchCandidates.map((row) => (
          <li key={row.id} className={styles.row}>
            <div className={styles.meta}>
              <p className={styles.title}>{row.title}</p>
              <p className={styles.sub}>
                {row.source.replace(/^api:/, "")} · {row.similarityLabel}
              </p>
              {row.sharedWords.length > 0 ? (
                <p className={styles.sharedWords}>
                  Shared: {row.sharedWords.join(", ")}
                </p>
              ) : null}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.reviewButton} onClick={() => onSelectCandidate(row.id)}>
                Review
              </button>
              {row.sourceUrl ? (
                <a href={row.sourceUrl} target="_blank" rel="noreferrer" className={styles.link}>
                  Source <ExternalLink size={12} aria-hidden />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
});
