import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EventRow } from "@/components/EventRow";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { PageChrome } from "@/components/PageChrome";
import { Skeleton } from "@/components/Skeleton";
import { Text } from "@/components/Text";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { listSeriesEvents } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

import styles from "./SeriesPage.module.css";

export function SeriesPage() {
  const { seriesId = "" } = useParams({ strict: false });
  const decodedId = decodeURIComponent(seriesId);
  const { data, isLoading } = useQuery({
    queryKey: eventsKeys.series(decodedId),
    queryFn: ({ signal }) => listSeriesEvents(decodedId, signal),
    enabled: Boolean(decodedId)
  });

  const rows = (data?.items ?? []).map((item) => toEventRowViewModel(item));
  const title = rows[0]?.title ?? "Series";

  return (
    <PageChrome mobileNav={{ variant: "day", title: "SERIES" }}>
      <div className={styles.wrap}>
        <Text variant="header1" tone="onPage" as="h1">
          {title}
        </Text>
        <Text variant="body2" tone="mutedOnPage" as="p" className={styles.sub}>
          All upcoming dates in this series
        </Text>
        {isLoading ? (
          <div className={styles.list} data-testid="series-page-skeleton" aria-busy="true">
            <Skeleton height={32} width="70%" />
            <Skeleton height={14} width="45%" className={styles.sub} />
            {Array.from({ length: 4 }, (_, index) => (
              <EventRowSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {rows.map((row) => (
              <EventRow key={row.id} event={row} slug={row.slug} adminAction={<AdminEditLink eventId={row.id} />} />
            ))}
          </div>
        )}
      </div>
    </PageChrome>
  );
}
