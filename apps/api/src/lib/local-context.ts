import type { LocalContextAirQuality, LocalContextResponse, LocalContextWeather } from "@fresno-events/shared";

import type { Env } from "@/env";
import { resolveGoogleMapsPlatformApiKey } from "@/lib/google-maps-platform";

const FRESNO_LAT = 36.7378;
const FRESNO_LNG = -119.7871;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  value: LocalContextResponse;
}

let memoryCache: CacheEntry | null = null;

function weatherIconForCondition(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes("rain") || lower.includes("shower")) return "🌧️";
  if (lower.includes("cloud")) return "☁️";
  if (lower.includes("clear") || lower.includes("sunny")) return "☀️";
  if (lower.includes("fog") || lower.includes("mist")) return "🌫️";
  return "🌤️";
}

async function fetchWeather(apiKey: string): Promise<LocalContextWeather | { ok: false }> {
  try {
    const url = new URL("https://weather.googleapis.com/v1/currentConditions:lookup");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("location.latitude", String(FRESNO_LAT));
    url.searchParams.set("location.longitude", String(FRESNO_LNG));
    url.searchParams.set("unitsSystem", "IMPERIAL");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return { ok: false };
    }

    const data = (await response.json()) as {
      temperature?: { degrees?: number; unit?: string };
      weatherCondition?: { description?: { text?: string } };
    };

    const rawTemp = data.temperature?.degrees ?? 0;
    const unit = data.temperature?.unit?.toUpperCase() ?? "FAHRENHEIT";
    const tempF = Math.round(unit === "CELSIUS" ? (rawTemp * 9) / 5 + 32 : rawTemp);
    const condition = data.weatherCondition?.description?.text ?? "Clear";
    return {
      ok: true,
      tempF,
      condition,
      icon: weatherIconForCondition(condition)
    };
  } catch {
    return { ok: false };
  }
}

async function fetchAirQuality(apiKey: string): Promise<LocalContextAirQuality | { ok: false }> {
  try {
    const url = new URL("https://airquality.googleapis.com/v1/currentConditions:lookup");
    url.searchParams.set("key", apiKey);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: FRESNO_LAT, longitude: FRESNO_LNG }
      })
    });

    if (!response.ok) {
      return { ok: false };
    }

    const data = (await response.json()) as {
      indexes?: Array<{ aqi?: number; category?: string }>;
    };
    const index = data.indexes?.[0];
    if (!index?.aqi) {
      return { ok: false };
    }

    return {
      ok: true,
      aqi: Math.round(index.aqi),
      category: index.category ?? "Unknown"
    };
  } catch {
    return { ok: false };
  }
}

export async function resolveLocalContext(env: Env): Promise<LocalContextResponse> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.value;
  }

  const apiKey = resolveGoogleMapsPlatformApiKey(env);
  if (!apiKey) {
    return {
      weather: { ok: false },
      airQuality: { ok: false },
      generatedAt: new Date().toISOString()
    };
  }

  const [weather, airQuality] = await Promise.all([fetchWeather(apiKey), fetchAirQuality(apiKey)]);
  const value: LocalContextResponse = {
    weather,
    airQuality,
    generatedAt: new Date().toISOString()
  };

  memoryCache = { expiresAt: now + CACHE_TTL_MS, value };
  return value;
}
