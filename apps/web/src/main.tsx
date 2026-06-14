import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AdminModeProvider } from "@/features/admin-mode/AdminModeProvider";
import { bootstrapGoogleAnalytics, getGaMeasurementId } from "@/lib/google-analytics/google-analytics.utils";
import { queryClient } from "@/lib/query-client";
import { applyInitialTheme } from "@/lib/theme/setTheme";
import { router } from "@/router";

import "@/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

applyInitialTheme("dim");

const gaMeasurementId = getGaMeasurementId();
if (gaMeasurementId) {
  void bootstrapGoogleAnalytics(gaMeasurementId);
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminModeProvider>
        <RouterProvider router={router} />
      </AdminModeProvider>
    </QueryClientProvider>
  </StrictMode>
);
