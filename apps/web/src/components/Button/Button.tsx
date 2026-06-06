import { cn } from "@/lib/cn";

import type { ButtonProps, ButtonSize, ButtonVariant, HtmlButtonType } from "./Button.types";
import styles from "./Button.module.css";

const variantClass = {
  approve: styles.approve ?? "",
  reject: styles.reject ?? "",
  secondary: styles.secondary ?? "",
  secondaryActive: styles.secondaryActive ?? "",
  ghost: styles.ghost ?? ""
} satisfies Record<ButtonVariant, string>;

const sizeClass = {
  xs: styles.xs ?? "",
  sm: styles.sm ?? "",
  md: styles.md ?? ""
} satisfies Record<ButtonSize, string>;

type ButtonElementProps = Extract<ButtonProps, { href?: undefined }>;

export function Button(props: ButtonProps) {
  if ("href" in props && props.href) {
    const { variant = "secondary", size = "md", className, children, href, ...linkProps } = props;
    const classes = cn(styles.base, variantClass[variant], sizeClass[size], className);

    return (
      <a href={href} className={classes} {...linkProps}>
        {children}
      </a>
    );
  }

  const {
    variant = "secondary",
    size = "md",
    className,
    children,
    type,
    ...buttonProps
  } = props as ButtonElementProps;
  const classes = cn(styles.base, variantClass[variant], sizeClass[size], className);
  const buttonType = (type ?? "button") as HtmlButtonType;

  return (
    <button type={buttonType} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
