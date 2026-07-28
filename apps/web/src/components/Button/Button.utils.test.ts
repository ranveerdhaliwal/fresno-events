import { describe, expect, it } from "vitest";

import { defaultButtonVariant, resolveButtonRenderKind } from "./Button.utils";
import styles from "./Button.module.css";
import { buttonClasses } from "./Button.utils";

describe("resolveButtonRenderKind", () => {
  it("detects router link", () => {
    expect(resolveButtonRenderKind({ to: "/search" })).toBe("router-link");
  });

  it("detects anchor", () => {
    expect(resolveButtonRenderKind({ href: "https://x.com" })).toBe("anchor");
  });

  it("defaults to button", () => {
    expect(resolveButtonRenderKind({})).toBe("button");
  });
});

describe("defaultButtonVariant", () => {
  it("uses cta for router links", () => {
    expect(defaultButtonVariant("router-link")).toBe("cta");
    expect(defaultButtonVariant("button")).toBe("secondary");
  });
});

describe("buttonClasses", () => {
  it("includes base and variant classes", () => {
    const className = buttonClasses("cta", "md");
    expect(className).toContain(styles.base);
    expect(className).toContain(styles.cta);
    expect(className).toContain(styles.md);
  });

  it("includes mustard variant class", () => {
    const className = buttonClasses("mustard", "xs");
    expect(className).toContain(styles.mustard);
    expect(className).toContain(styles.xs);
  });
});
