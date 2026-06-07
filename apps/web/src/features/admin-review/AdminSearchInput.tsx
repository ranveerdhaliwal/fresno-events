import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { TextInput } from "@/components/TextInput/TextInput";

import styles from "./AdminReviewWorkspace.module.css";

export interface AdminSearchInputProps {
  onDebouncedChange: (query: string) => void;
  debounceMs?: number;
}

/** Local input state so typing does not re-render the full review workspace. */
export function AdminSearchInput({ onDebouncedChange, debounceMs = 250 }: AdminSearchInputProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => onDebouncedChange(value), debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, debounceMs, onDebouncedChange]);

  return (
    <div className={styles.searchRow}>
      <Search className={styles.searchIcon} size={16} aria-hidden />
      <TextInput
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search all candidates by title, venue, or source…"
        aria-label="Search all candidates"
        className={styles.searchInput}
      />
    </div>
  );
}
