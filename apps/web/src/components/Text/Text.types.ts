import type { ComponentPropsWithoutRef, ElementType } from "react";

export const TEXT_VARIANTS = [
  "header1",
  "header2",
  "header3",
  "eyebrow",
  "navLabel",
  "price",
  "body1",
  "body2",
  "body3",
  "script"
] as const;

export type TextVariant = (typeof TEXT_VARIANTS)[number];

export const TEXT_TONES = [
  "onPage",
  "onCard",
  "onNav",
  "accent",
  "mutedOnPage",
  "mutedOnCard",
  "label",
  "labelOnCard",
  "inverse",
  "inherit"
] as const;

export type TextTone = (typeof TEXT_TONES)[number];

export const TEXT_SCRIPT_STYLES = ["default", "section", "nav", "footer"] as const;

export type TextScriptStyle = (typeof TEXT_SCRIPT_STYLES)[number];

type TextOwnProps = {
  variant: TextVariant;
  tone?: TextTone;
  scriptStyle?: TextScriptStyle;
  as?: ElementType;
  className?: string | undefined;
};

export type TextProps<T extends ElementType = "p"> = TextOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof TextOwnProps | "as">;
