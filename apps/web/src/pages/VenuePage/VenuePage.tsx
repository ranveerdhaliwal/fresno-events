import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EventRow } from "@/components/EventRow";
import { PageChrome } from "@/components/PageChrome";
import { VenueMiniMap } from "@/components/VenueMiniMap";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { formatVenueAddressLine } from "@/lib/venue-display.utils";
import { getVenueDetail } from "@/services/events.service";
import { eventsKeys } from "@/services/events.queryKeys";

import styles from "./VenuePage.module.css";

export function VenuePage() {
  const { slug = "" } = useParams({ strict: false });
  const { data, isLoading, isError } = useQuery({
    queryKey: eventsKeys.venue(slug),
    queryFn: ({ signal }) => getVenueDetail(slug, signal),
    enabled: Boolean(slug)
  });

  const rows = (data?.upcomingEvents ?? []).map((item) => toEventRowViewModel(item));

  return (
    <PageChrome mobileNav={{ variant: "day", title: "VENUE" }}>
      <div className={styles.wrap}>
        {isLoading ? <p>Loading venue…</p> : null}
        {isError || !data ? !isLoading ? <p>Venue not found.</p> : null : null}
        {data ? (
          <>
            <h1>{data.venue.name}</h1>
            <p className={styles.address}>{formatVenueAddressLine(data.venue)}</p>
            {data.venue.lat != null && data.venue.lng != null ? (
              <VenueMiniMap lat={data.venue.lat} lng={data.venue.lng} category="community" />
            ) : null}
            {data.venue.website ? (
              <a href={data.venue.website} target="_blank" rel="noreferrer" className={styles.website}>
                Website
              </a>
            ) : null}
            <h2 className={styles.sectionTitle}>Upcoming events</h2>
            <div className={styles.list}>
              {rows.length === 0 ? <p className={styles.empty}>No events yet</p> : null}
              {rows.map((row) => (
                <EventRow key={row.id} event={row} slug={row.slug} adminAction={<AdminEditLink eventId={row.id} />} />
              ))}
            </div>
            <Link to="/" className={styles.back}>
              ← Back home
            </Link>
          </>
        ) : null}
      </div>
    </PageChrome>
  );
}
