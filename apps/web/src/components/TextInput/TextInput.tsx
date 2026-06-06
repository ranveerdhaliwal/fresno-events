import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import controlStyles from "../FormControls/control.module.css";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlStyles.control, className)} {...props} />;
}
