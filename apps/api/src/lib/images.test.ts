import { describe, expect, it } from "vitest";

import { registerSourceImage } from "@/lib/images";
import type { Env } from "@/env";

describe("registerSourceImage", () => {
  it("returns null for non-http URLs", async () => {
    const env = {} as Env;
    await expect(registerSourceImage(env, "not-a-url", null)).resolves.toBeNull();
  });
});
