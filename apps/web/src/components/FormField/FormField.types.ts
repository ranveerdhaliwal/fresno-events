import type { ReactNode } from "react";

export type FormFieldLink = {
  href: string;
  label?: string;
};

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  link?: FormFieldLink;
  fullWidth?: boolean;
  className?: string;
  /** Emphasize fields that differ from a published baseline (admin review). */
  highlightChanged?: boolean;
};
