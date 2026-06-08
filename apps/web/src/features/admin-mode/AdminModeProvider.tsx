import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { adminKeys } from "@/features/admin/admin.queryKeys";
import { eventsKeys } from "@/services/events.queryKeys";

import {
  broadcastAdminCache,
  persistAdminModeEnabled,
  readAdminModeEnabled,
  subscribeAdminCache
} from "./admin-cache";

interface AdminModeContextValue {
  adminModeEnabled: boolean;
  setAdminModeEnabled: (enabled: boolean) => void;
  toggleAdminMode: () => void;
}

const AdminModeContext = createContext<AdminModeContextValue | null>(null);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [adminModeEnabled, setAdminModeEnabledState] = useState(() => readAdminModeEnabled());

  const setAdminModeEnabled = useCallback((enabled: boolean) => {
    setAdminModeEnabledState(enabled);
    persistAdminModeEnabled(enabled);
    broadcastAdminCache({ type: "admin-mode", enabled });
  }, []);

  const toggleAdminMode = useCallback(() => {
    setAdminModeEnabled(!adminModeEnabled);
  }, [adminModeEnabled, setAdminModeEnabled]);

  useEffect(() => {
    return subscribeAdminCache((message) => {
      if (message.type === "admin-mode") {
        setAdminModeEnabledState(message.enabled);
        persistAdminModeEnabled(message.enabled);
        return;
      }

      if (message.type === "homepage-updated") {
        void queryClient.invalidateQueries({ queryKey: eventsKeys.homepage() });
        void queryClient.invalidateQueries({ queryKey: adminKeys.homepageSlots() });
        return;
      }

      if (message.type === "event-updated") {
        void queryClient.invalidateQueries({ queryKey: adminKeys.publishedEvent(message.eventId) });
        void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "published-events"] });
        void queryClient.invalidateQueries({ queryKey: eventsKeys.all });
      }
    });
  }, [queryClient]);

  const value = useMemo(
    () => ({ adminModeEnabled, setAdminModeEnabled, toggleAdminMode }),
    [adminModeEnabled, setAdminModeEnabled, toggleAdminMode]
  );

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode() {
  const ctx = useContext(AdminModeContext);
  if (!ctx) {
    throw new Error("useAdminMode must be used within AdminModeProvider");
  }
  return ctx;
}

export function useAdminModeOptional() {
  return useContext(AdminModeContext);
}
