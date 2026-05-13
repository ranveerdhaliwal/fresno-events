import { vi } from "vitest";

import type { Env } from "@/env";

function createMockR2Bucket(): R2Bucket {
  return {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn()
  };
}

/** Minimal `Env` for `app.fetch` tests; merge overrides for specific bindings. */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    APP_ENV: "test",
    ALLOWED_ORIGIN: "http://localhost:5173",
    EVENT_IMAGES: createMockR2Bucket(),
    ...overrides
  };
}
