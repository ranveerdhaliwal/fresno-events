import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { Text } from "./Text";
import styles from "./Text.module.css";

describe("Text", () => {
  it("renders body copy on card surfaces with dark ink", () => {
    renderWithProviders(
      <Text variant="body1" tone="onCard" data-testid="status-message">
        Approved 2.
      </Text>
    );

    const node = screen.getByTestId("status-message");
    expect(node).toHaveTextContent("Approved 2.");
    expect(node.className).toContain(styles.body1);
    expect(node.className).toContain(styles.toneOnCard);
  });

  it("uses brand tone for vivid coral on page scripts", () => {
    renderWithProviders(
      <Text variant="script" tone="brand" data-testid="brand-script">
        what&apos;s
      </Text>
    );

    const node = screen.getByTestId("brand-script");
    expect(node.className).toContain(styles.toneBrand);
  });

  it("applies weight and onDark stroke props", () => {
    renderWithProviders(
      <Text variant="header1" tone="onPage" weight="medium" stroke="onDark" data-testid="stroked-title">
        Events
      </Text>
    );

    const node = screen.getByTestId("stroked-title");
    expect(node.className).toContain(styles.weightMedium);
    expect(node.className).toContain(styles.strokeOnDark);
  });
});
