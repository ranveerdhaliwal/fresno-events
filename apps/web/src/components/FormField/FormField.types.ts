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
};
