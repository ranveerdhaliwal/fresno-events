import { cn } from "@/lib/cn";

import type { FormFieldProps } from "./FormField.types";
import styles from "./FormField.module.css";

export function FormField({
  label,
  children,
  hint,
  link,
  fullWidth,
  className,
  highlightChanged
}: FormFieldProps) {
  return (
    <label
      className={cn(
        styles.field,
        fullWidth && styles.fullWidth,
        highlightChanged && styles.highlightChanged,
        className
      )}
    >
      <span className={styles.label}>{label}</span>
      <div className={styles.controlWrap}>{children}</div>
      {link?.href.trim() ? (
        <a href={link.href.trim()} target="_blank" rel="noreferrer" className={styles.link} title={link.href}>
          {link.label ?? link.href}
        </a>
      ) : null}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </label>
  );
}
