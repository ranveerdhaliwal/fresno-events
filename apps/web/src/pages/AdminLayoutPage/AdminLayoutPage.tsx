import { AdminShell } from "@/features/admin-shell/AdminShell";
import { buildAdminSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";

import styles from "./AdminLayoutPage.module.css";

export function AdminLayoutPage() {
  useSeoHead(buildAdminSeo());

  return (
    <div className={styles.page} data-testid="admin-page">
      <AdminShell />
    </div>
  );
}
