import styles from "./ContextStrip.module.css";

export interface ContextStripProps {
  countdown: string;
}

export function ContextStrip({ countdown }: ContextStripProps) {
  return (
    <div className={styles.strip} data-testid="context-strip">
      <span>{countdown}</span>
    </div>
  );
}
