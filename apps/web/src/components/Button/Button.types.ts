import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "@tanstack/react-router";

export type ButtonVariant =
  | "approve"
  | "reject"
  | "secondary"
  | "secondaryActive"
  | "ghost"
  | "cta"
  | "mustard";

export type ButtonSize = "xs" | "sm" | "md";

type HtmlButtonType = NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["type"]>;

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string | undefined;
};

export type ButtonProps =
  | (ButtonBaseProps &
      Omit<LinkProps, "className" | "children"> & {
        href?: undefined;
      })
  | (ButtonBaseProps &
      { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
        to?: undefined;
      })
  | (ButtonBaseProps &
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
        href?: undefined;
        to?: undefined;
      });

export type { HtmlButtonType };
