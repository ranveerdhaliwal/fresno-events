import { useState } from "react";
import { useParams } from "@tanstack/react-router";

import { EventEditorWorkspace } from "@/features/event-editor/EventEditorWorkspace";
import { TokenGate } from "@/features/admin-review/TokenGate";
import { AUTH_FAILURE_MESSAGE } from "@/features/admin-review/AdminReviewWorkspace.types";
import { clearStoredToken, persistToken, readStoredToken } from "@/features/admin-review/AdminReviewWorkspace.utils";

export function AdminEventEditorPage() {
  const { eventId } = useParams({ from: "/admin/events/$eventId" });
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
    <EventEditorWorkspace
      token={token}
      eventId={eventId}
      onAuthFailure={() => {
        clearStoredToken();
        setToken(null);
        setAuthError(AUTH_FAILURE_MESSAGE);
      }}
    />
  );
}
