import { useParams } from "@tanstack/react-router";

import { PageChrome } from "@/components/PageChrome";
import {
  EventDetailError,
  EventDetailLoading,
  EventDetailView
} from "@/features/event-detail-sections/EventDetailView";
import { useEventDetail } from "@/features/event-detail-sections/useEventDetail";

export function EventDetailPage() {
  const { slug = "" } = useParams({ strict: false });
  const { data, isLoading, isError, refetch } = useEventDetail(slug);

  return (
    <PageChrome mobileNav={{ variant: "event" }} showBottomTabs>
      {isLoading ? <EventDetailLoading /> : null}
      {isError || !data ? !isLoading ? <EventDetailError onRetry={() => void refetch()} /> : null : null}
      {data ? <EventDetailView data={data} /> : null}
    </PageChrome>
  );
}
