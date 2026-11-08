import { describe, expect, it } from "vitest";
import { assertProductionApiUrl } from "../../build/production-api";

describe("public deployment API configuration", () => {
  it("accepts the cloud endpoint", () => {
    expect(() => assertProductionApiUrl("https://api.whatupfresno.com")).not.toThrow();
  });
  it.each([
    undefined, "", "http://127.0.0.1:8790", "https://127.0.0.1:8790",
    "http://localhost:8790", "https://localhost", "https://[::1]",
    "https://10.0.0.1", "https://192.168.1.10", "https://172.16.0.1",
    "https://preview.localhost", "https://user:password@api.whatupfresno.com"
  ])("refuses a missing or private deployment API: %s", value => {
    expect(() => assertProductionApiUrl(value)).toThrow(/public HTTPS VITE_API_URL/);
  });
});
