/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_SLOT_BANNER_WIDE?: string;
  readonly VITE_ADSENSE_SLOT_BANNER_STACKED?: string;
  readonly VITE_ADSENSE_SLOT_CARD?: string;
  readonly VITE_ADSENSE_SLOT_SIDE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
