import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "approve" | "reject" | "secondary" | "secondaryActive" | "ghost";

export type ButtonSize = "xs" | "sm" | "md";

type HtmlButtonType = NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["type"]>;

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string | undefined;
};

export type ButtonProps = ButtonBaseProps &
  (
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children">)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">)
  );

export type { HtmlButtonType };
