import styles from "./CtaRow.module.css";

export function CtaRow() {
  return (
    <a href="#digest" className={styles.row} data-testid="cta-row">
      <span>FREE WEEKLY DIGEST</span>
      <span className={styles.sub}>Every Thursday · No spam</span>
      <span className={styles.arrow}>→</span>
    </a>
  );
}
