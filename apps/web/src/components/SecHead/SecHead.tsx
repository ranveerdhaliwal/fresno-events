import { cn } from "@/lib/cn";

import styles from "./SecHead.module.css";

export interface SecHeadProps {
  number?: string;
  script?: string;
  title: string;
  count?: number;
  variant?: "default" | "live";
}

export function SecHead({ number, script, title, count, variant = "default" }: SecHeadProps) {
  return (
    <div className={cn(styles.head, variant === "live" && styles.live)} data-testid="sec-head">
      <h2>
        {variant === "live" ? <span className={styles.liveDot} aria-hidden /> : null}
        {script ? <span className={styles.script}>{script}</span> : null}
        {title}
      </h2>
      {count !== undefined ? (
        <span className={styles.count}>{count}</span>
      ) : number ? (
        <span className={styles.count}>{number}</span>
      ) : null}
    </div>
  );
}
