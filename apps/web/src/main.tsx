import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ComingSoonPage } from "@/components/coming-soon-page";
import { AdminModeProvider } from "@/features/admin-mode/AdminModeProvider";
import { queryClient } from "@/lib/query-client";
import { applyInitialTheme } from "@/lib/theme/setTheme";
import { router } from "@/router";

import "@/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const showComingSoon = import.meta.env.VITE_COMING_SOON === "true";

applyInitialTheme("dim");

createRoot(rootElement).render(
  <StrictMode>
    {showComingSoon ? (
      <ComingSoonPage />
    ) : (
      <QueryClientProvider client={queryClient}>
        <AdminModeProvider>
          <RouterProvider router={router} />
        </AdminModeProvider>
      </QueryClientProvider>
    )}
  </StrictMode>
);
