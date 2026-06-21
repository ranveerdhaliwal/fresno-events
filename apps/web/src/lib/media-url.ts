/**
 * Hero images use upstream HTTPS URLs from ingest sources.
 * Relative paths (legacy) resolve against VITE_API_URL when set.
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
