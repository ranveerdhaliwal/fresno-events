import type { IngestEnv } from "@/env";
import type { JsonPromptBackend, StructuredLLM, TextLLM, TextProviderName, TextProviderRole } from "@/llm/types";
import { PromptStructuredAdapter } from "@/llm/adapters/prompt-structured";
import { createAnthropicJsonBackend } from "@/llm/providers/anthropic/json-backend";
import { GeminiStructuredLlm, GeminiTextLlm } from "@/llm/providers/gemini/gemini-structured";
import { resolveGeminiApiKeyFromStrings } from "@/llm/providers/gemini/client";
import { createWorkersAiJsonBackend } from "@/llm/providers/workers-ai/json-backend";

function normalizeProvider(value: string | undefined): TextProviderName | null {
  const v = value?.trim().toLowerCase();
  if (v === "workers_ai" || v === "gemini" || v === "anthropic") {
    return v;
  }
  return null;
}

function roleSpecificProvider(env: IngestEnv, role: TextProviderRole): string | undefined {
  if (role === "enrichment") {
    return env.AI_TEXT_PROVIDER_ENRICHMENT?.trim();
  }
  return env.AI_TEXT_PROVIDER_DISCOVERY?.trim();
}

function hasGeminiKey(env: IngestEnv): boolean {
  return Boolean(resolveGeminiApiKeyFromStrings(env.GEMINI_API_KEY, env.GOOGLE_API_KEY));
}

/**
 * Resolution order:
 * 1. AI_TEXT_PROVIDER_<ROLE> (e.g. AI_TEXT_PROVIDER_ENRICHMENT)
 * 2. AI_TEXT_PROVIDER
 * 3. Default: workers_ai when AI binding exists, else gemini when key present, else anthropic when key present.
 */
export function resolveTextProvider(env: IngestEnv, role?: TextProviderRole): TextProviderName | null {
  const fromRole = role ? roleSpecificProvider(env, role) : undefined;
  const fromCap = (fromRole && fromRole.length > 0 ? fromRole : env.AI_TEXT_PROVIDER)?.trim();
  const explicit = fromCap ? normalizeProvider(fromCap) : null;

  if (explicit) {
    if (explicit === "workers_ai") {
      return env.AI ? "workers_ai" : null;
    }
    if (explicit === "gemini") {
      return "gemini";
    }
    if (explicit === "anthropic") {
      return env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : null;
    }
  }

  // Local `wrangler dev` exposes the AI binding stub but calls fail unless --remote.
  const preferExternalLlm = env.APP_ENV === "local" || env.APP_ENV === "development";

  if (preferExternalLlm) {
    if (hasGeminiKey(env)) {
      return "gemini";
    }
    if (env.ANTHROPIC_API_KEY?.trim()) {
      return "anthropic";
    }
  }

  if (env.AI) {
    return "workers_ai";
  }
  if (hasGeminiKey(env)) {
    return "gemini";
  }
  if (env.ANTHROPIC_API_KEY?.trim()) {
    return "anthropic";
  }
  return null;
}

function createJsonBackendForProvider(env: IngestEnv, name: TextProviderName): JsonPromptBackend | null {
  switch (name) {
    case "workers_ai": {
      if (!env.AI) {
        return null;
      }
      return createWorkersAiJsonBackend(env.AI);
    }
    case "gemini": {
      return new GeminiStructuredLlm(env).toJsonPromptBackend();
    }
    case "anthropic": {
      const key = env.ANTHROPIC_API_KEY?.trim();
      if (!key) {
        return null;
      }
      return createAnthropicJsonBackend(key);
    }
    default: {
      return null;
    }
  }
}

export function getJsonPromptBackend(env: IngestEnv, role?: TextProviderRole): JsonPromptBackend | null {
  const name = resolveTextProvider(env, role);
  if (!name) {
    return null;
  }
  return createJsonBackendForProvider(env, name);
}

export function getStructuredLLM(env: IngestEnv, role?: TextProviderRole): StructuredLLM | null {
  const name = resolveTextProvider(env, role);
  if (!name) {
    return null;
  }
  if (name === "gemini") {
    return new GeminiStructuredLlm(env);
  }
  const json = createJsonBackendForProvider(env, name);
  if (!json) {
    return null;
  }
  return new PromptStructuredAdapter(json);
}

export function getTextLLM(env: IngestEnv, role?: TextProviderRole): TextLLM | null {
  const name = resolveTextProvider(env, role);
  if (name !== "gemini") {
    return null;
  }
  return new GeminiTextLlm(env);
}
