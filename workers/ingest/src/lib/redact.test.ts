import { describe, expect, it } from "vitest";

import { redactCredentialsInUrl } from "./redact";

describe("redactCredentialsInUrl", () => {
  it("redacts token and key params", () => {
    const url = "https://example.com/api?token=secret&key=abc123&foo=bar";
    expect(redactCredentialsInUrl(url)).toBe(
      "https://example.com/api?token=REDACTED&key=REDACTED&foo=bar"
    );
  });

  it("is case-insensitive", () => {
    const url = "https://example.com?API_KEY=xyz";
    expect(redactCredentialsInUrl(url)).toContain("API_KEY=REDACTED");
  });
});
