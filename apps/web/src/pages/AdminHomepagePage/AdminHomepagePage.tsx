import { useState } from "react";

import { HomepageCurationWorkspace } from "@/features/homepage-curation/HomepageCurationWorkspace";
import { TokenGate } from "@/features/admin-review/TokenGate";
import { AUTH_FAILURE_MESSAGE } from "@/features/admin-review/AdminReviewWorkspace.types";
import { clearStoredToken, persistToken, readStoredToken } from "@/features/admin-review/AdminReviewWorkspace.utils";

export function AdminHomepagePage() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [authError, setAuthError] = useState<string | null>(null);

  if (!token) {
    return (
      <TokenGate
        authError={authError}
        onAuthenticate={(value) => {
          persistToken(value);
          setAuthError(null);
          setToken(value);
        }}
      />
    );
  }

  return (
    <HomepageCurationWorkspace
      token={token}
      onAuthFailure={() => {
        clearStoredToken();
        setToken(null);
        setAuthError(AUTH_FAILURE_MESSAGE);
      }}
    />
  );
}
