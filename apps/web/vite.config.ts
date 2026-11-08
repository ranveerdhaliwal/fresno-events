import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { assertProductionApiUrl } from "./build/production-api";

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    assertProductionApiUrl(process.env.VITE_API_URL ?? env.VITE_API_URL);
  }
  return {
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "What Up Fresno",
        short_name: "What Up Fresno",
        description: "Discover concerts, festivals, food, art, sports, and community events across Fresno and the Central Valley.",
        theme_color: "#1A1A1A",
        background_color: "#F4E8D0",
        display: "standalone",
        start_url: "/",
        icons: []
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        // Must be a precached URL. "/" is not in the manifest (index.html is),
        // which makes workbox throw non-precached-url on every navigation.
        navigateFallback: "/index.html"
      }
    })
  ],
  server: {
    // Explicit IPv4 loopback — `host: true` can listen on IPv6-only on WSL so
    // 127.0.0.1:5182 refuses while Vite still prints "ready" + Network URLs.
    host: "127.0.0.1",
    port: Number(process.env.FRESNO_WEB_PORT ?? 5182),
    strictPort: true,
    hmr: {
      host: "localhost",
      clientPort: Number(process.env.FRESNO_WEB_PORT ?? 5182)
    },
    proxy: {
      "/images": {
        target: `http://127.0.0.1:${process.env.FRESNO_API_PORT ?? 8790}`,
        changeOrigin: true
      }
    }
  }
  };
});
