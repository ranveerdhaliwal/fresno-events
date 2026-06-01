const CHANNEL_NAME = "wuf-admin-cache";

export type AdminCacheMessage =
  | { type: "admin-mode"; enabled: boolean }
  | { type: "homepage-updated" }
  | { type: "event-updated"; eventId: string };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastAdminCache(message: AdminCacheMessage) {
  getChannel()?.postMessage(message);
}

export function subscribeAdminCache(callback: (message: AdminCacheMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) {
    return () => undefined;
  }

  const handler = (event: MessageEvent<AdminCacheMessage>) => {
    callback(event.data);
  };

  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}

export const ADMIN_MODE_STORAGE_KEY = "wuf:admin_mode";

export function readAdminModeEnabled(): boolean {
  try {
    return localStorage.getItem(ADMIN_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistAdminModeEnabled(enabled: boolean) {
  try {
    localStorage.setItem(ADMIN_MODE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}
