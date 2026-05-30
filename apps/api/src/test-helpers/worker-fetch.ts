import type { Hono } from "hono";
import { vi } from "vitest";

import type { Env } from "@/env";

function createMockExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {}
  };
}

type App = Hono<{ Bindings: Env }>;

export async function workerFetch(
  app: App,
  input: RequestInfo | URL,
  env: Env,
  init?: RequestInit
): Promise<Response> {
  const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
  return app.fetch(request, env, createMockExecutionContext());
}
