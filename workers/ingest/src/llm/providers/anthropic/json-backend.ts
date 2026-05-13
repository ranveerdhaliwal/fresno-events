import type { JsonPromptBackend, JsonPromptRequest } from "@/llm/types";
import { parseJsonFromModel } from "@/llm/parse-json";

export function createAnthropicJsonBackend(apiKey: string): JsonPromptBackend {
  return {
    provider: "anthropic",
    async generateJson<T>({ system, user }: JsonPromptRequest): Promise<T | null> {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 1024,
            system: `${system}\nRespond with only valid minified JSON. No prose, no code fences.`,
            messages: [{ role: "user", content: user }],
          }),
        });

        if (!response.ok) {
          console.log(
            JSON.stringify({
              event: "anthropic_error",
              status: response.status,
              body: await safeText(response),
            }),
          );
          return null;
        }

        const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = payload.content?.find((part) => part.type === "text")?.text ?? "";
        return parseJsonFromModel<T>(text);
      } catch (error) {
        console.log(JSON.stringify({ event: "anthropic_error", message: messageOf(error) }));
        return null;
      }
    },
  };
}

async function safeText(response: Response) {
  try {
    return (await response.text()).slice(0, 240);
  } catch {
    return "";
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
