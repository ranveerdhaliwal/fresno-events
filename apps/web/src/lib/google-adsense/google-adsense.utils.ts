import "./google-adsense.types";

const ADSENSE_SCRIPT_MARKER = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

export function loadAdSenseScript(clientId: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src*="${ADSENSE_SCRIPT_MARKER}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load AdSense script"));
    document.head.appendChild(script);
  });
}

export function pushAdSenseSlot(): void {
  try {
    window.adsbygoogle = window.adsbygoogle ?? [];
    window.adsbygoogle.push({});
  } catch {
    // Ad blockers or strict CSP may throw; fail silently.
  }
}
