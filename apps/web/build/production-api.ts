export function assertProductionApiUrl(value: string | undefined): void {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error("Production builds require a public HTTPS VITE_API_URL.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const privateHost = host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host === "::1" || host === "::" ||
    /^(?:0|10|127)\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    (host.includes(":") && /^(?:fc|fd|fe80:)/i.test(host));
  if (url.protocol !== "https:" || privateHost || url.username || url.password) {
    throw new Error("Production builds require a public HTTPS VITE_API_URL; local API addresses cannot be deployed.");
  }
}
