import type { SelectHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import controlStyles from "../FormControls/control.module.css";

export function SelectInput({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(controlStyles.control, className)} {...props}>
      {children}
    </select>
  );
}
