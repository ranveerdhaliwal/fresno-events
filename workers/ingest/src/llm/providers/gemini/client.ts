import { GoogleGenAI } from "@google/genai";

export function stripSurroundingQuotes(raw: string): string {
  return raw.replace(/^['"]|['"]$/g, "");
}

export function resolveGeminiApiKeyFromStrings(primary?: string, secondary?: string): string {
  const raw = String(primary ?? secondary ?? "").trim();
  return stripSurroundingQuotes(raw);
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in the Worker environment and redeploy.",
    );
  }
  return new GoogleGenAI({ apiKey });
}
