import type { Env } from "@/env";
import { supabaseRequest } from "@/lib/supabase-client";
import type { ImageInsert, RegisteredImage } from "@/lib/images.types";
import { logError } from "@/lib/structured-log";

export type { RegisteredImage } from "@/lib/images.types";

/**
 * Persist a hero image row that points at the upstream source URL (no download or self-hosting).
 */
export async function registerSourceImage(
  env: Env,
  imageUrl: string,
  altText: string | null
): Promise<RegisteredImage | null> {
  if (!isHttpUrl(imageUrl)) {
    return null;
  }

  const existing = await findImageBySource(env, imageUrl);
  if (existing) {
    return existing;
  }

  const storageKey = await storageKeyForSourceUrl(imageUrl);

  return await upsertImageRow(env, {
    storage_key: storageKey,
    cdn_url: imageUrl,
    source_url: imageUrl,
    alt_text: altText
  });
}

async function findImageBySource(env: Env, imageUrl: string): Promise<RegisteredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url",
    source_url: `eq.${imageUrl}`,
    limit: "1"
  });

  const rows = await supabaseRequest<RegisteredImage[]>(env, `/rest/v1/images?${params}`);
  return rows[0] ?? null;
}

async function upsertImageRow(env: Env, row: ImageInsert): Promise<RegisteredImage> {
  const existingByKey = await findImageByStorageKey(env, row.storage_key);
  if (existingByKey) {
    return existingByKey;
  }

  try {
    const params = new URLSearchParams({
      select: "id,storage_key,cdn_url",
      on_conflict: "storage_key"
    });

    const rows = await supabaseRequest<RegisteredImage[]>(env, `/rest/v1/images?${params}`, {
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

async function findImageByStorageKey(env: Env, storageKey: string): Promise<RegisteredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url",
    storage_key: `eq.${storageKey}`,
    limit: "1"
  });

  const rows = await supabaseRequest<RegisteredImage[]>(env, `/rest/v1/images?${params}`);
  return rows[0] ?? null;
}

async function insertImageRow(env: Env, row: ImageInsert): Promise<RegisteredImage | null> {
  const params = new URLSearchParams({
    select: "id,storage_key,cdn_url"
  });

  try {
    const rows = await supabaseRequest<RegisteredImage[]>(env, `/rest/v1/images?${params}`, {
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

async function storageKeyForSourceUrl(imageUrl: string): Promise<string> {
  const hash = await sha256Hex(new TextEncoder().encode(imageUrl));
  return `source/${hash}`;
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
