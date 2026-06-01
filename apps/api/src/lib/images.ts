import type { Env } from "@/env";
import { supabaseRequest } from "@/lib/supabase-client";
import type { DownloadedImage, ImageInsert, MirroredImage } from "@/lib/images.types";
import { logError } from "@/lib/structured-log";

export type { MirroredImage } from "@/lib/images.types";

/**
 * Mirror a remote event image to the R2 EVENT_IMAGES bucket and persist a row
 * in the `public.images` table. Returns the image id (or null when mirroring is
 * skipped because the bucket is not bound or the image cannot be fetched).
 */
export async function mirrorImageToR2(env: Env, imageUrl: string, altText: string | null): Promise<MirroredImage | null> {
  if (!env.EVENT_IMAGES) {
    return null;
  }

  if (!isHttpUrl(imageUrl)) {
    return null;
  }

  const existing = await findImageBySource(env, imageUrl);
  if (existing) {
    return existing;
  }

  const downloaded = await downloadImage(imageUrl);
  if (!downloaded) {
    return null;
  }

  const sha = await sha256Hex(downloaded.bytes);
  const extension = inferExtension(downloaded.contentType, imageUrl);
  const storageKey = `events/${sha}${extension}`;

  const head = await env.EVENT_IMAGES.head(storageKey);
  if (!head) {
    await env.EVENT_IMAGES.put(storageKey, downloaded.bytes, {
      httpMetadata: { contentType: downloaded.contentType }
    });
  }

  const cdnUrl = buildCdnUrl(env, storageKey);

  return await upsertImageRow(env, {
    storage_key: storageKey,
    cdn_url: cdnUrl,
    source_url: imageUrl,
    alt_text: altText
  });
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

async function downloadImage(imageUrl: string): Promise<DownloadedImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      headers: { Accept: "image/*" },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok || !response.body) {
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length && length > MAX_IMAGE_BYTES) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    return { bytes: new Uint8Array(buffer), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function findImageBySource(env: Env, imageUrl: string): Promise<MirroredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url",
    source_url: `eq.${imageUrl}`,
    limit: "1"
  });

  const rows = await supabaseRequest<MirroredImage[]>(env, `/rest/v1/images?${params}`);
  return rows[0] ?? null;
}

async function upsertImageRow(env: Env, row: ImageInsert): Promise<MirroredImage> {
  const existingByKey = await findImageByStorageKey(env, row.storage_key);
  if (existingByKey) {
    return existingByKey;
  }

  try {
    const params = new URLSearchParams({
      select: "id,storage_key,cdn_url",
      on_conflict: "storage_key"
    });

    const rows = await supabaseRequest<MirroredImage[]>(env, `/rest/v1/images?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(row)
    });

    const stored = rows[0];
    if (!stored) {
      throw new Error("Image upsert returned no rows.");
    }

    return stored;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("42P10") && !message.includes("ON CONFLICT")) {
      throw error;
    }

    const inserted = await insertImageRow(env, row);
    if (inserted) {
      return inserted;
    }

    const raced = await findImageByStorageKey(env, row.storage_key);
    if (raced) {
      return raced;
    }

    logError("image_upsert_failed", error, { storage_key: row.storage_key, source_url: row.source_url });
    throw error;
  }
}

async function findImageByStorageKey(env: Env, storageKey: string): Promise<MirroredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url",
    storage_key: `eq.${storageKey}`,
    limit: "1"
  });

  const rows = await supabaseRequest<MirroredImage[]>(env, `/rest/v1/images?${params}`);
  return rows[0] ?? null;
}

async function insertImageRow(env: Env, row: ImageInsert): Promise<MirroredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url"
  });

  try {
    const rows = await supabaseRequest<MirroredImage[]>(env, `/rest/v1/images?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(row)
    });

    return rows[0] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("23505") || message.includes("duplicate key")) {
      return null;
    }

    throw error;
  }
}

function buildCdnUrl(env: Env, storageKey: string) {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}/${storageKey}`;
  }

  return `/images/${storageKey}`;
}

function inferExtension(contentType: string, sourceUrl: string) {
  const fromMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/svg+xml": ".svg"
  };
  if (fromMime[contentType]) {
    return fromMime[contentType];
  }

  try {
    const pathname = new URL(sourceUrl).pathname;
    const match = pathname.match(/\.[a-zA-Z0-9]{2,5}$/);
    if (match) {
      return match[0].toLowerCase();
    }
  } catch {
    // ignore
  }

  return ".bin";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hashBuffer: ArrayBuffer = await crypto.subtle.digest({ name: "SHA-256" }, view as unknown as ArrayBuffer);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
