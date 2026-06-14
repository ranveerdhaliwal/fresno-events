import "./google-analytics.types";

const GTAG_SCRIPT_MARKER = "googletagmanager.com/gtag/js";

export function getGaMeasurementId(): string | undefined {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  return id || undefined;
}

export function isGoogleAnalyticsEnabled(): boolean {
  return getGaMeasurementId() !== undefined;
}

export function shouldTrackPath(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}

export function loadGoogleAnalyticsScript(measurementId: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src*="${GTAG_SCRIPT_MARKER}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Analytics script"));
    document.head.appendChild(script);
  });
}

export function initGoogleAnalytics(measurementId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

export async function bootstrapGoogleAnalytics(measurementId: string): Promise<void> {
  await loadGoogleAnalyticsScript(measurementId);
  initGoogleAnalytics(measurementId);
}

export function trackPageView(pathname: string, search?: string): void {
  if (!window.gtag || !isGoogleAnalyticsEnabled()) {
    return;
  }

  const pagePath = search ? `${pathname}${search}` : pathname;
  window.gtag("event", "page_view", { page_path: pagePath });
}
