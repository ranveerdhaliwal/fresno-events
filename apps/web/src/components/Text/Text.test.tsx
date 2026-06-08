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

  it("defaults page headings to on-page tone", () => {
    renderWithProviders(<Text variant="header1">Review queue</Text>);

    const heading = screen.getByRole("heading", { level: 1, name: "Review queue" });
    expect(heading.className).toContain(styles.header1);
    expect(heading.className).toContain(styles.toneOnPage);
  });
});
