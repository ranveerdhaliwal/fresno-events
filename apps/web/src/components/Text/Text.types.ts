import type { ComponentPropsWithoutRef, ElementType } from "react";

export const TEXT_VARIANTS = [
  "header1",
  "header2",
  "header3",
  "eyebrow",
  "caps",
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
  "brand",
  "mutedOnPage",
  "mutedOnCard",
  "label",
  "labelOnCard",
  "inverse",
  "inherit"
] as const;

export type TextTone = (typeof TEXT_TONES)[number];

export const TEXT_WEIGHTS = [
  "light",
  "regular",
  "medium",
  "semibold",
  "bold",
  "extrabold"
] as const;

export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export const TEXT_STROKES = ["none", "onDark"] as const;

export type TextStroke = (typeof TEXT_STROKES)[number];

export const TEXT_SCRIPT_STYLES = ["default", "section", "nav", "footer"] as const;

export type TextScriptStyle = (typeof TEXT_SCRIPT_STYLES)[number];

type TextOwnProps = {
  variant: TextVariant;
  tone?: TextTone;
  /** Override the variant default weight (maps to --text-weight-* tokens). */
  weight?: TextWeight;
  /**
   * Glyph outline for titles on navy / dark page surfaces.
   * Prefer this over a box border around the word.
   */
  stroke?: TextStroke;
  scriptStyle?: TextScriptStyle;
  as?: ElementType;
  className?: string | undefined;
};

export type TextProps<T extends ElementType = "p"> = TextOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof TextOwnProps | "as">;
