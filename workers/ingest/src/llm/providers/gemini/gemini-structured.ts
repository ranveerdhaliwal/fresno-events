import type { GenerateContentConfig } from "@google/genai";

import type { IngestEnv } from "@/env";
import type { JsonPromptBackend, JsonPromptRequest, StructuredLLM, StructuredRequest, TextLLM, TextRequest } from "@/llm/types";
import { parseJsonFromModel } from "@/llm/parse-json";
import { chatMessagesToContents } from "@/llm/providers/gemini/contents";
import { createGeminiClient, resolveGeminiApiKeyFromStrings } from "@/llm/providers/gemini/client";
import { GEMINI_DEFAULT_MODEL } from "@/llm/providers/gemini/models";

type GeminiEnvPick = Pick<IngestEnv, "GEMINI_API_KEY" | "GOOGLE_API_KEY" | "GEMINI_MODEL">;

export class GeminiStructuredLlm implements StructuredLLM {
  readonly provider = "gemini";
  private readonly defaultModel: string;

  constructor(private readonly env: GeminiEnvPick) {
    this.defaultModel = env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  }

  toJsonPromptBackend(): JsonPromptBackend {
    return {
      provider: "gemini",
      generateJson: async <T>(req: JsonPromptRequest) => {
        try {
          const structured: StructuredRequest<T> = {
            systemInstruction: req.system,
            messages: [{ role: "user", content: [{ kind: "text", text: req.user }] }],
          };
          if (typeof req.temperature === "number") {
            structured.temperature = req.temperature;
          }
          if (typeof req.maxOutputTokens === "number") {
            structured.maxOutputTokens = req.maxOutputTokens;
          }
          const { parsed } = await this.completeJson<T>(structured);
          return parsed;
        } catch (error) {
          console.log(JSON.stringify({ event: "gemini_error", message: messageOf(error) }));
          return null;
        }
      },
    };
  }

  async completeJson<T>(req: StructuredRequest<T>): Promise<{ parsed: T; rawText: string }> {
    const apiKey = resolveGeminiApiKeyFromStrings(this.env.GEMINI_API_KEY, this.env.GOOGLE_API_KEY);
    const ai = createGeminiClient(apiKey);
    const contents = chatMessagesToContents(req.messages);
    const config: GenerateContentConfig = {
      responseMimeType: "application/json",
    };
    if (req.systemInstruction) {
      config.systemInstruction = req.systemInstruction;
    }
    if (typeof req.temperature === "number") {
      config.temperature = req.temperature;
    }
    if (typeof req.maxOutputTokens === "number") {
      config.maxOutputTokens = req.maxOutputTokens;
    }
    if (req.schema && Object.keys(req.schema).length > 0) {
      config.responseJsonSchema = req.schema;
    }

    const response = await ai.models.generateContent({
      model: req.modelOverride ?? this.defaultModel,
      contents,
      config,
    });

    const rawText = response.text ?? "";
    let parsed: T;
    try {
      parsed = JSON.parse(rawText) as T;
    } catch {
      const recovered = parseJsonFromModel<T>(rawText);
      if (recovered === null) {
        throw new Error("Gemini returned non-JSON output for a JSON-mode request.");
      }
      parsed = recovered;
    }
    return { parsed, rawText };
  }
}

export class GeminiTextLlm implements TextLLM {
  readonly provider = "gemini";
  private readonly defaultModel: string;

  constructor(private readonly env: GeminiEnvPick) {
    this.defaultModel = env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  }

  async complete(req: TextRequest): Promise<{ text: string }> {
    const apiKey = resolveGeminiApiKeyFromStrings(this.env.GEMINI_API_KEY, this.env.GOOGLE_API_KEY);
    const ai = createGeminiClient(apiKey);
    const contents = chatMessagesToContents(req.messages);
    const config: GenerateContentConfig = {};
    if (req.systemInstruction) {
      config.systemInstruction = req.systemInstruction;
    }
    if (typeof req.temperature === "number") {
      config.temperature = req.temperature;
    }
    if (typeof req.maxOutputTokens === "number") {
      config.maxOutputTokens = req.maxOutputTokens;
    }
    const response = await ai.models.generateContent({
      model: req.modelOverride ?? this.defaultModel,
      contents,
      config,
    });
    return { text: response.text ?? "" };
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
