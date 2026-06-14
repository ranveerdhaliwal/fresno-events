import { memo } from "react";
import { ExternalLink } from "lucide-react";

import type { LinkedEventCandidate } from "@fresno-events/shared";

import styles from "./LinkedSourcesSection.module.css";

export const LinkedSourcesSection = memo(function LinkedSourcesSection({
  linkedCandidates
}: {
  linkedCandidates: LinkedEventCandidate[];
}) {
  if (linkedCandidates.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Also listed on</h3>
      <ul className={styles.list}>
        {linkedCandidates.map((row) => (
          <li key={row.id} className={styles.row}>
            <div className={styles.meta}>
              <p className={styles.title}>{row.title}</p>
              <p className={styles.sub}>
                {row.source} · {row.status}
              </p>
            </div>
            {row.sourceUrl ? (
              <a href={row.sourceUrl} target="_blank" rel="noreferrer" className={styles.link}>
                Source <ExternalLink size={12} aria-hidden />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
});
