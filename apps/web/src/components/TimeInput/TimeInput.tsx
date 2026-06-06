import type { InputHTMLAttributes } from "react";

import { TextInput } from "@/components/TextInput/TextInput";

export function TimeInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <TextInput type="time" {...props} />;
}
