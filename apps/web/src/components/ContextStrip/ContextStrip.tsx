import { Link } from "@tanstack/react-router";

import styles from "./ContextStrip.module.css";

export interface ContextStripProps {
  dayIso: string;
  countdown: string;
}

export function ContextStrip({ dayIso, countdown }: ContextStripProps) {
  return (
    <div className={styles.strip} data-testid="context-strip">
      <Link to="/day/$date" params={{ date: dayIso }}>
        ← Back to day
      </Link>
      <span>{countdown}</span>
    </div>
  );
}
