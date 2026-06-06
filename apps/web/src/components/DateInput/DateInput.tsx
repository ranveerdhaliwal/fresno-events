import type { InputHTMLAttributes } from "react";

import { TextInput } from "@/components/TextInput/TextInput";

export function DateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput type="date" {...props} />;
}
