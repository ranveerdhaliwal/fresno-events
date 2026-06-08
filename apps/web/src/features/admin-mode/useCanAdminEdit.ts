import { useEffect, useState } from "react";

import { readStoredToken } from "@/features/admin-review/AdminReviewWorkspace.utils";

import { useAdminModeOptional } from "./AdminModeProvider";

/** True when admin edit affordances should show on the public site. */
export function useCanAdminEdit(): boolean {
  const adminMode = useAdminModeOptional();
  const [hasToken, setHasToken] = useState(() => Boolean(readStoredToken()));

  useEffect(() => {
    setHasToken(Boolean(readStoredToken()));
  }, [adminMode?.adminModeEnabled]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "wuf:admin_token") {
        setHasToken(Boolean(readStoredToken()));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return Boolean(adminMode?.adminModeEnabled) || hasToken;
}
