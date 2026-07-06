import { Link } from "@tanstack/react-router";

import { Text } from "@/components/Text";

import styles from "./SeeAllDayCta.module.css";

export interface SeeAllDayCtaProps {
  date: string;
  count: number;
  variant?: "desktop" | "mobile";
}

export function SeeAllDayCta({ date, count, variant = "desktop" }: SeeAllDayCtaProps) {
  const label = `SEE ALL ${count} EVENTS ON ${date.toUpperCase()} →`;
  return (
    <Link
      to="/day/$date"
      params={{ date }}
      className={variant === "mobile" ? styles.mobile : styles.desktop}
      data-testid="see-all-day-cta"
    >
      <Text variant="eyebrow" tone="inherit" as="span">
        {label}
      </Text>
    </Link>
  );
}
