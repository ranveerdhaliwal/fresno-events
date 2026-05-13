import { describe, expect, it } from "vitest";

import app from "@/index";
import { createMockEnv } from "@/test-helpers/create-mock-env";
import { workerFetch } from "@/test-helpers/worker-fetch";

describe("GET /health", () => {
  it("returns ok payload with service metadata", async () => {
    const env = createMockEnv({ APP_ENV: "test" });
    const res = await workerFetch(app, "http://localhost/health", env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      data: { service: string; environment: string; time: string };
    };

    expect(body.ok).toBe(true);
    expect(body.data.service).toBe("fresno-events-api");
    expect(body.data.environment).toBe("test");
    expect(() => new Date(body.data.time)).not.toThrow();
    expect(Number.isNaN(new Date(body.data.time).getTime())).toBe(false);
  });
});
