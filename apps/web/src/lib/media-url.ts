/**
 * Hero images from approve may use `/images/...` (served by the API Worker).
 * The Vite app runs on a different port — resolve against VITE_API_URL.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const apiBase = import.meta.env.VITE_API_URL?.trim();
    if (!apiBase) {
      return trimmed;
    }
    return new URL(trimmed, apiBase.endsWith("/") ? apiBase : `${apiBase}/`).href;
  }

  return trimmed;
}
