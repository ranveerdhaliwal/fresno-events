import { useParams } from "@tanstack/react-router";

import { PublishedEventsAdminWorkspace } from "@/features/published-events-admin/PublishedEventsAdminWorkspace";

export function AdminEventEditorPage() {
  const { eventId } = useParams({ from: "/admin/events/$eventId" });

  return <PublishedEventsAdminWorkspace selectedEventId={eventId} />;
}
