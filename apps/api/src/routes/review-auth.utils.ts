import type { Env } from "@/env";

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureCompare(actual: string, expected: string) {
  const [actualHash, expectedHash] = await Promise.all([sha256(actual), sha256(expected)]);
  let diff = actualHash.length ^ expectedHash.length;

  for (let index = 0; index < Math.max(actualHash.length, expectedHash.length); index += 1) {
    diff |= (actualHash[index] ?? 0) ^ (expectedHash[index] ?? 0);
  }

  return diff === 0;
}

export async function requireReviewAuth(env: Env, authorization?: string, adminToken?: string) {
  if (!env.ADMIN_REVIEW_TOKEN) {
    return {
      code: "review_auth_unconfigured",
      message: "ADMIN_REVIEW_TOKEN must be configured before review routes can be used.",
      status: 503 as const
    };
  }

  const provided = adminToken ?? authorization?.replace(/^Bearer\s+/i, "");

  if (!provided || !(await secureCompare(provided, env.ADMIN_REVIEW_TOKEN))) {
    return {
      code: "review_auth_required",
      message: "A valid review token is required.",
      status: 401 as const
    };
  }

  return null;
}
