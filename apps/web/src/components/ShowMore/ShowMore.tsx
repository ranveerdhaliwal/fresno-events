import styles from "./ShowMore.module.css";

export function ShowMore({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className={styles.btn} onClick={onClick} data-testid="show-more">
      SHOW MORE EVENTS ↓
    </button>
  );
}
