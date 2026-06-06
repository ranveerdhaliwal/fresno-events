import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import controlStyles from "../FormControls/control.module.css";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: "default" | "description";
};

export function TextArea({ className, rows = 4, variant = "default", ...props }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
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
