import styles from "./FooterStamp.module.css";

export function FooterStamp() {
  return (
    <footer className={styles.stamp} data-testid="footer-stamp">
      <span className={styles.id}>WUF · EVENT ID STAMP</span>
      <span className={styles.greeting}>greetings from the central valley</span>
    </footer>
  );
}
