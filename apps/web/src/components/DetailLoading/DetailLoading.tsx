import { Loader2 } from "lucide-react";

import styles from "./DetailLoading.module.css";

export function DetailLoading() {
  return (
    <div className={styles.placeholder}>
      <Loader2 className="size-4 animate-spin" />
      <span>Loading candidate...</span>
    </div>
  );
}
