import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import controlStyles from "../FormControls/control.module.css";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: "default" | "description";
};

export function TextArea({ className, rows, variant = "default", ...props }: TextAreaProps) {
  const resolvedRows = rows ?? (variant === "description" ? 14 : 4);

  return (
    <textarea
      rows={resolvedRows}
      className={cn(
        controlStyles.control,
        controlStyles.textarea,
        variant === "description" && controlStyles.description,
        className
      )}
      {...props}
    />
  );
}
