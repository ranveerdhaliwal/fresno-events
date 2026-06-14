import type { ApiResponse, LocalContextResponse } from "@fresno-events/shared";

export async function getLocalContext(signal?: AbortSignal): Promise<LocalContextResponse> {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (!apiUrl) {
    return {
      weather: { ok: false },
      airQuality: { ok: false },
      generatedAt: new Date().toISOString()
    };
  }

  const response = await fetch(new URL("/context/local", apiUrl), {
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {})
  });

  if (!response.ok) {
    return {
      weather: { ok: false },
      airQuality: { ok: false },
      generatedAt: new Date().toISOString()
    };
  }

  const payload = (await response.json()) as ApiResponse<LocalContextResponse>;
  if (!payload.ok) {
    return {
      weather: { ok: false },
      airQuality: { ok: false },
      generatedAt: new Date().toISOString()
    };
  }

  return payload.data;
}
