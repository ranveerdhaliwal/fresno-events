import { describe, expect, it } from "vitest";

import { renderWithSiteRouter } from "@/tests/router-render";
import { screen } from "@/tests/render";
import { getMockEventList } from "@/services/events.mock";
import { toFeatureCardViewModel } from "@/lib/event-view-model";

import { FeatureCard } from "./FeatureCard";

describe("FeatureCard", () => {
  it("renders feature card with title", async () => {
    const card = toFeatureCardViewModel(getMockEventList()[0]!);

    await renderWithSiteRouter(<FeatureCard card={card} variant="small" />);

    expect(screen.getByTestId(`feature-card-${card.slug}`)).toBeInTheDocument();
    expect(screen.getByText(card.title)).toBeInTheDocument();
  });
});
