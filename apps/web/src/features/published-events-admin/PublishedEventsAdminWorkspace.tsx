import { useState } from "react";

import { TokenGate } from "@/features/admin-review/TokenGate";
import { AUTH_FAILURE_MESSAGE } from "@/features/admin-review/AdminReviewWorkspace.types";
import { clearStoredToken, persistToken, readStoredToken } from "@/features/admin-review/AdminReviewWorkspace.utils";

import { PublishedEventsWorkspace } from "./PublishedEventsWorkspace";

export interface PublishedEventsAdminWorkspaceProps {
  selectedEventId: string | null;
}

export function PublishedEventsAdminWorkspace({ selectedEventId }: PublishedEventsAdminWorkspaceProps) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [authError, setAuthError] = useState<string | null>(null);

  const clearToken = () => {
    clearStoredToken();
    setToken(null);
  };

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
    <PublishedEventsWorkspace
      token={token}
      selectedEventId={selectedEventId}
      onChangeToken={() => {
        clearToken();
        setAuthError(null);
      }}
      onAuthFailure={() => {
        clearToken();
        setAuthError(AUTH_FAILURE_MESSAGE);
      }}
    />
  );
}
