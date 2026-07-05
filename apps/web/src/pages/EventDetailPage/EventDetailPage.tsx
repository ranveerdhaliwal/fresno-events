import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { PageChrome } from "@/components/PageChrome";
import {
  EventDetailError,
  EventDetailLoading,
  EventDetailView
} from "@/features/event-detail-sections/EventDetailView";
import { useEventDetail } from "@/features/event-detail-sections/useEventDetail";
import { buildEventSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { toIsoDateLocal } from "@/lib/event-time";

export function EventDetailPage() {
  const { slug = "" } = useParams({ strict: false });
  const { data, isLoading, isError, refetch } = useEventDetail(slug);

  const seo = useMemo(() => {
    if (!data) {
      return null;
    }
    const dayIso = toIsoDateLocal(new Date(data.detail.event.startTs));
    return buildEventSeo(data.detail, dayIso);
  }, [data]);

  useSeoHead(seo);

  return (
    <PageChrome mobileNav={{ variant: "event" }}>
      {isLoading ? <EventDetailLoading /> : null}
      {isError || !data ? !isLoading ? <EventDetailError onRetry={() => void refetch()} /> : null : null}
      {data ? <EventDetailView data={data} /> : null}
    </PageChrome>
  );
}
