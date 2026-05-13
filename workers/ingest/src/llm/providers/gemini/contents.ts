import type { Content, Part } from "@google/genai";

import type { ChatMessage } from "@/llm/types";

export function chatMessagesToContents(messages: ChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: message.content.map((part): Part => {
      if (part.kind === "text") {
        return { text: part.text };
      }
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.dataBase64,
        },
      };
    }),
  }));
}
