import { Link } from "@tanstack/react-router";

import { AdminReviewWorkspace } from "@/features/admin-review/AdminReviewWorkspace";

import styles from "./AdminPage.module.css";

export function AdminPage() {
  return (
    <div className={styles.page} data-testid="admin-page">
      <header className={styles.bar}>
        <Link to="/" className={styles.home}>
          ← What Up Fresno
        </Link>
        <span className={styles.label}>Admin review</span>
      </header>
      <div className={styles.content}>
        <AdminReviewWorkspace />
      </div>
    </div>
  );
}
