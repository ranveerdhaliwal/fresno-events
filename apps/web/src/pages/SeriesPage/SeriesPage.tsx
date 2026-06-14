import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EventRow } from "@/components/EventRow";
import { PageChrome } from "@/components/PageChrome";
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
        <h1>{title}</h1>
        <p className={styles.sub}>All upcoming dates in this series</p>
        {isLoading ? <p>Loading…</p> : null}
        <div className={styles.list}>
          {rows.map((row) => (
            <EventRow key={row.id} event={row} slug={row.slug} adminAction={<AdminEditLink eventId={row.id} />} />
          ))}
        </div>
      </div>
    </PageChrome>
  );
}
