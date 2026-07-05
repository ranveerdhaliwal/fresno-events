import { Link } from "@tanstack/react-router";

import type { ButtonProps, HtmlButtonType } from "./Button.types";
import { buttonClasses, defaultButtonVariant, resolveButtonRenderKind } from "./Button.utils";

export function Button(props: ButtonProps) {
  const kind = resolveButtonRenderKind(props);

  if (kind === "router-link" && "to" in props && props.to != null) {
    const { variant = defaultButtonVariant(kind), size = "md", className, children, to, ...linkProps } = props;

    return (
      <Link to={to} className={buttonClasses(variant, size, className)} {...linkProps}>
        {children}
      </Link>
    );
  }

  if (kind === "anchor" && "href" in props && typeof props.href === "string") {
    const { variant = defaultButtonVariant(kind), size = "md", className, children, href, ...linkProps } = props;

    return (
      <a href={href} className={buttonClasses(variant, size, className)} {...linkProps}>
        {children}
      </a>
    );
  }

  const buttonProps = props as Extract<ButtonProps, { to?: undefined; href?: undefined }>;
  const {
    variant = defaultButtonVariant(kind),
    size = "md",
    className,
    children,
    type,
    ...rest
  } = buttonProps;
  const buttonType = (type ?? "button") as HtmlButtonType;

  return (
    <button type={buttonType} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
