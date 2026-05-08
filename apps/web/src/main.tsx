import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ComingSoonPage } from "@/components/coming-soon-page";
import { queryClient } from "@/lib/query-client";
import { router } from "@/router";

import "@/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const showComingSoon = import.meta.env.VITE_COMING_SOON === "true";

createRoot(rootElement).render(
  <StrictMode>
    {showComingSoon ? (
      <ComingSoonPage />
    ) : (
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </QueryClientProvider>
    )}
  </StrictMode>
);
