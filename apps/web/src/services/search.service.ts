import type { ApiResponse, SearchResponse } from "@fresno-events/shared";

function getApiUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  return value ? value : null;
}

export async function searchAll(
  query: string,
  options?: { limit?: number; signal?: AbortSignal }
): Promise<SearchResponse> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("VITE_API_URL is not set.");
  }

  const params = new URLSearchParams({ q: query });
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  const response = await fetch(new URL(`/search?${params}`, apiUrl), {
    headers: { Accept: "application/json" },
    ...(options?.signal ? { signal: options.signal } : {})
  });

  const payload = (await response.json()) as ApiResponse<SearchResponse>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}
