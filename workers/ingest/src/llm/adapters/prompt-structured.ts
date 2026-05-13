import type { JsonPromptBackend, JsonPromptRequest, StructuredLLM, StructuredRequest, TextRequest } from "@/llm/types";

function flattenUserText(req: StructuredRequest | TextRequest): string {
  const lines: string[] = [];
  for (const message of req.messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.content) {
      if (part.kind === "text") {
        lines.push(part.text);
      }
    }
  }
  return lines.join("\n\n").trim();
}

/** Uses prompt-style JSON (no native schema) via an existing JSON prompt backend. */
export class PromptStructuredAdapter implements StructuredLLM {
  readonly provider: string;

  constructor(private readonly inner: JsonPromptBackend) {
    this.provider = inner.provider;
  }

  async completeJson<T>(req: StructuredRequest<T>): Promise<{ parsed: T; rawText: string }> {
    const system = req.systemInstruction ?? "";
    const user = flattenUserText(req);
    const prompt: JsonPromptRequest = { system, user };
    if (typeof req.temperature === "number") {
      prompt.temperature = req.temperature;
    }
    if (typeof req.maxOutputTokens === "number") {
      prompt.maxOutputTokens = req.maxOutputTokens;
    }
    const raw = await this.inner.generateJson<unknown>(prompt);
    if (raw === null) {
      throw new Error(`${this.provider} returned no JSON for structured request.`);
    }
    const rawText = JSON.stringify(raw);
    return { parsed: raw as T, rawText };
  }
}
