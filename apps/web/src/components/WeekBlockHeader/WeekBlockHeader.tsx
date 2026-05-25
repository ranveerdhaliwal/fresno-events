import styles from "./WeekBlockHeader.module.css";

export interface WeekBlockHeaderProps {
  label: string;
  dateRange: string;
}

export function WeekBlockHeader({ label, dateRange }: WeekBlockHeaderProps) {
  return (
    <div className={styles.header} data-testid="week-block-header">
      <span className={styles.script}>next</span>
      <h3>{label}</h3>
      <span className={styles.dates}>{dateRange}</span>
    </div>
  );
}
