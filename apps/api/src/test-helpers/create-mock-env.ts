import type { Env } from "@/env";

/** Minimal `Env` for `app.fetch` tests; merge overrides for specific bindings. */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    APP_ENV: "test",
    ALLOWED_ORIGIN: "http://localhost:5182",
    ...overrides
  };
}
