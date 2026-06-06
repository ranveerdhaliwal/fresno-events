// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { supabaseRequest } from "@/lib/supabase-client";

const env = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
} as const;

describe("supabaseRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined for successful empty responses (return=minimal)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );

    const result = await supabaseRequest<void>(env, "/rest/v1/event_candidates?id=eq.abc", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" }
    });

    expect(result).toBeUndefined();
  });

  it("parses JSON for successful responses with a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: "abc" }]), { status: 200 }))
    );

    const result = await supabaseRequest<Array<{ id: string }>>(env, "/rest/v1/event_candidates?id=eq.abc");

    expect(result).toEqual([{ id: "abc" }]);
  });
});
