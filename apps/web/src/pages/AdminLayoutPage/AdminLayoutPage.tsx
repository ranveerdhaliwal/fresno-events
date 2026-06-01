import { AdminShell } from "@/features/admin-shell/AdminShell";

import styles from "./AdminLayoutPage.module.css";

export function AdminLayoutPage() {
  return (
    <div className={styles.page} data-testid="admin-page">
      <AdminShell />
    </div>
  );
}
