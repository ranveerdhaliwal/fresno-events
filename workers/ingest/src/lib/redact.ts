/** Strip credential query params before logging URLs. */
export function redactCredentialsInUrl(url: string): string {
  return url.replace(/(token|key|api[_-]?key|access[_-]?token)=([^&]+)/gi, "$1=REDACTED");
}
