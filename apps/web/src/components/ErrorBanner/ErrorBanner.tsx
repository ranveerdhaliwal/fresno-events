import { ShieldAlert } from "lucide-react";

import { formatErrorBannerContent } from "./ErrorBanner.utils";
import styles from "./ErrorBanner.module.css";

export function ErrorBanner({ error }: { error: unknown }) {
  const { message, status } = formatErrorBannerContent(error);

  return (
    <div className={styles.banner}>
      <div className={styles.head}>
        <ShieldAlert size={16} aria-hidden />
        <span className={styles.title}>Request failed</span>
      </div>
      <p className={styles.message}>
        {message}
        {status ? ` (HTTP ${status})` : ""}
      </p>
    </div>
  );
}
