import type { ComponentPropsWithoutRef, ElementType } from "react";

export const TEXT_VARIANTS = [
  "header1",
  "header2",
  "header3",
  "eyebrow",
  "body1",
  "body2",
  "body3",
  "script"
] as const;

export type TextVariant = (typeof TEXT_VARIANTS)[number];

export const TEXT_TONES = [
  "onPage",
  "onCard",
  "mutedOnPage",
  "mutedOnCard",
  "label",
  "labelOnCard",
  "inherit"
] as const;

export type TextTone = (typeof TEXT_TONES)[number];

type TextOwnProps = {
  variant: TextVariant;
  tone?: TextTone;
  as?: ElementType;
  className?: string | undefined;
};

export type TextProps<T extends ElementType = "p"> = TextOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof TextOwnProps | "as">;
