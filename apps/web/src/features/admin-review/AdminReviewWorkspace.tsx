import { useState } from "react";

import type { ReviewQueueTab } from "../admin/admin-api";

import { AUTH_FAILURE_MESSAGE } from "./AdminReviewWorkspace.types";
import { clearStoredToken, persistToken, readStoredToken } from "./AdminReviewWorkspace.utils";
import { ReviewWorkspace } from "./ReviewWorkspace";
import { TokenGate } from "./TokenGate";

export function AdminReviewWorkspace() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewQueueTab>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clearToken = () => {
    clearStoredToken();
    setToken(null);
    setSelectedId(null);
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
    <ReviewWorkspace
      token={token}
      activeTab={activeTab}
      onActiveTabChange={(value, nextSelectedId) => {
        setActiveTab(value);
        setSelectedId(nextSelectedId ?? null);
      }}
      selectedId={selectedId}
      onSelect={setSelectedId}
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
