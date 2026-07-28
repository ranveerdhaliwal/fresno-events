import { Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { SelectableEventRow } from "@/components/SelectableEventRow";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { PageChrome } from "@/components/PageChrome";
import { Skeleton } from "@/components/Skeleton";
import { Text } from "@/components/Text";
import { VenueMiniMap } from "@/components/VenueMiniMap";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { formatVenueAddressLine } from "@/lib/venue-display.utils";
import { buildVenueSeo } from "@/lib/seo/page-seo";
import { useSeoHead } from "@/lib/seo/useSeoHead";
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

  const seo = useMemo(() => (data ? buildVenueSeo(data) : null), [data]);
  useSeoHead(seo);

  const rows = (data?.upcomingEvents ?? []).map((item) => toEventRowViewModel(item));

  return (
    <PageChrome mobileNav={{ variant: "day", title: "VENUE" }}>
      <div className={styles.wrap}>
        {isLoading ? (
          <div data-testid="venue-page-skeleton" aria-busy="true">
            <Skeleton height={32} width="55%" />
            <Skeleton height={14} width="40%" className={styles.address} />
            <Skeleton height={200} width="100%" radius={0} />
            <Skeleton height={20} width={180} className={styles.sectionTitle} />
            <div className={styles.list}>
              {Array.from({ length: 4 }, (_, index) => (
                <EventRowSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : null}
        {isError || !data ? (
          !isLoading ? (
            <Text variant="body2" tone="label">
              Venue not found.
            </Text>
          ) : null
        ) : null}
        {data ? (
          <>
            <Text variant="header1" tone="onPage" stroke="onDark" as="h1">
              {data.venue.name}
            </Text>
            <Text variant="body2" tone="mutedOnPage" as="p" className={styles.address}>
              {formatVenueAddressLine(data.venue)}
            </Text>
            {data.venue.lat != null && data.venue.lng != null ? (
              <VenueMiniMap lat={data.venue.lat} lng={data.venue.lng} category="community" />
            ) : null}
            {data.venue.website ? (
              <a href={data.venue.website} target="_blank" rel="noreferrer" className={styles.website}>
                Website
              </a>
            ) : null}
            <Text variant="header2" tone="onPage" stroke="onDark" as="h2" className={styles.sectionTitle}>
              Upcoming events
            </Text>
            <div className={styles.list}>
              {rows.length === 0 ? (
                <Text variant="body2" tone="mutedOnPage" className={styles.empty}>
                  No events yet
                </Text>
              ) : null}
              {rows.map((row) => (
                <SelectableEventRow
                  key={row.id}
                  event={row}
                  linkRows
                  adminAction={<AdminEditLink eventId={row.id} />}
                />
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
