import { describe, expect, it } from "vitest";

import { CENTRAL_VALLEY_GREETING, capitalizeScriptPhrase } from "./section-script.utils";

describe("capitalizeScriptPhrase", () => {
  it("capitalizes the first letter of each word", () => {
    expect(capitalizeScriptPhrase("what's")).toBe("What's");
    expect(capitalizeScriptPhrase("the story")).toBe("The Story");
    expect(capitalizeScriptPhrase("who's playing")).toBe("Who's Playing");
  });

  it("trims and collapses whitespace", () => {
    expect(capitalizeScriptPhrase("  pick a  ")).toBe("Pick A");
  });
});

describe("CENTRAL_VALLEY_GREETING", () => {
  it("uses title case for Greetings and Central Valley", () => {
    expect(CENTRAL_VALLEY_GREETING).toBe("Greetings from the Central Valley");
  });
});
