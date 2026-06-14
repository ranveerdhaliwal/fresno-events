export type GtagCommand = "config" | "event" | "js" | "set";

export interface GtagFunction {
  (command: "config", targetId: string, config?: Record<string, unknown>): void;
  (command: "event", eventName: string, params?: Record<string, unknown>): void;
  (command: "js", date: Date): void;
  (command: "set", params: Record<string, unknown>): void;
  (command: GtagCommand, ...args: unknown[]): void;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFunction;
  }
}

export {};
