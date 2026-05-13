import type { JsonPromptBackend, JsonPromptRequest } from "@/llm/types";
import { parseJsonFromModel } from "@/llm/parse-json";

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function createWorkersAiJsonBackend(ai: Ai): JsonPromptBackend {
  return {
    provider: "workers_ai",
    async generateJson<T>({ system, user }: JsonPromptRequest): Promise<T | null> {
      try {
        const response = (await ai.run(WORKERS_AI_MODEL, {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1024,
        })) as { response?: string };

        if (!response?.response) {
          return null;
        }
        return parseJsonFromModel<T>(response.response);
      } catch (error) {
        console.log(JSON.stringify({ event: "workers_ai_error", message: messageOf(error) }));
        return null;
      }
    },
  };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
