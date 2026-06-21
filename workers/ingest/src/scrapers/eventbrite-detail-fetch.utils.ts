import { sleep } from "@/lib/sleep";
import {
  looksLikeEventbriteBlockPage,
  parseEventbriteDetailHtml
} from "@/scrapers/eventbrite-detail.utils";

export const DEFAULT_EVENTBRITE_DETAIL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const DEFAULT_EVENTBRITE_DETAIL_DELAY_MS = 2500;
export const DEFAULT_EVENTBRITE_DETAIL_JITTER_MS = 500;
export const DEFAULT_EVENTBRITE_DETAIL_CIRCUIT_THRESHOLD = 3;

const FETCH_RETRIES = 1;
const RETRY_BASE_MS = 1500;

export type EventbriteDetailFetchOutcome =
  | { kind: "ok"; html: string; detail: ReturnType<typeof parseEventbriteDetailHtml> }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string };

export interface EventbriteDetailFetchOptions {
  userAgent?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export function resolveEventbriteDetailUserAgent(envUserAgent?: string): string {
  const fromEnv = envUserAgent?.trim();
  if (fromEnv && !fromEnv.toLowerCase().includes("bot")) {
    return fromEnv;
  }
  return DEFAULT_EVENTBRITE_DETAIL_USER_AGENT;
}

export async function fetchEventbriteDetailHtml(
  url: string,
  options: EventbriteDetailFetchOptions = {}
): Promise<{ html: string; status: number }> {
  const fetchFn = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_EVENTBRITE_DETAIL_USER_AGENT;
  let lastError: Error = new Error(`Failed fetching ${url}`);

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const response = await fetchFn(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9"
        },
        ...(options.signal ? { signal: options.signal } : {})
      });

      const html = await response.text();

      if (response.status === 403 || looksLikeEventbriteBlockPage(html)) {
        return { html, status: 403 };
      }

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} fetching ${url}`);
        if (response.status === 429 || response.status >= 500) {
          if (attempt < FETCH_RETRIES) {
            await sleep(RETRY_BASE_MS * 2 ** attempt);
            continue;
          }
        }
        throw lastError;
      }

      return { html, status: response.status };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(`Failed fetching ${url}`);
      if (attempt < FETCH_RETRIES) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError;
}

export async function fetchAndParseEventbriteDetail(
  url: string,
  options: EventbriteDetailFetchOptions = {}
): Promise<EventbriteDetailFetchOutcome> {
  try {
    const { html, status } = await fetchEventbriteDetailHtml(url, options);
    if (status === 403) {
      return { kind: "blocked", message: "Eventbrite returned 403 or captcha page" };
    }

    const detail = parseEventbriteDetailHtml(html);
    if (!detail) {
      return { kind: "error", message: "Could not parse __NEXT_DATA__ structured description" };
    }

    return { kind: "ok", html, detail };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Eventbrite detail fetch failed"
    };
  }
}

export function jitteredDelayMs(baseMs: number, jitterMs: number): number {
  return baseMs + Math.floor(Math.random() * (jitterMs + 1));
}
