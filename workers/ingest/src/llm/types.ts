/**
 * Vendor-neutral LLM contracts for the ingest worker.
 * No imports from @google/genai or other provider SDKs.
 */

export type ChatRole = "user" | "model";

export type ChatContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; mimeType: string; dataBase64: string };

export interface ChatMessage {
  role: ChatRole;
  content: ChatContentPart[];
}

export interface TextRequest {
  systemInstruction?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  modelOverride?: string;
}

export interface TextLLM {
  readonly provider: string;
  complete(req: TextRequest): Promise<{ text: string }>;
}

/** Subset of JSON Schema supported by providers that accept native schemas. */
export type JsonSchema = Record<string, unknown>;

export interface StructuredRequest<T = unknown> extends TextRequest {
  schema?: JsonSchema;
}

export interface StructuredLLM {
  readonly provider: string;
  completeJson<T>(req: StructuredRequest<T>): Promise<{ parsed: T; rawText: string }>;
}

export interface JsonPromptRequest {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Used by enrichment / discovery: single system + user JSON generation. */
export interface JsonPromptBackend {
  readonly provider: string;
  generateJson<T>(req: JsonPromptRequest): Promise<T | null>;
}

export type TextProviderRole = "enrichment" | "discovery";

export type TextProviderName = "workers_ai" | "gemini" | "anthropic";
