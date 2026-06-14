import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Link2, Loader2, Unlink } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { EventCandidate, SeriesSiblingCandidate } from "@fresno-events/shared";

import { Button } from "@/components/Button/Button";
import { TextInput } from "@/components/TextInput/TextInput";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";
import { linkCandidatesAsSeries, listCandidates, unlinkCandidateFromSeries } from "../admin/admin-api";

import styles from "./SeriesLinkPanel.module.css";

interface SeriesLinkPanelProps {
  token: string;
  candidate: EventCandidate;
  seriesSiblings: SeriesSiblingCandidate[];
  onSelectCandidate: (id: string) => void;
  onSeriesUpdated: () => void;
}

const LINK_SEARCH_STATUSES = ["pending_review", "approved"] as const;

function SeriesLinkRow({
  title,
  meta,
  action,
  onOpen
}: {
  title: string;
  meta: string;
  action: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        {onOpen ? (
          <button type="button" className={styles.rowOpen} onClick={onOpen}>
            <p className={styles.rowTitle}>{title}</p>
            <p className={styles.rowMeta}>
              <CalendarDays className={styles.rowMetaIcon} aria-hidden />
              {meta}
            </p>
          </button>
        ) : (
          <>
            <p className={styles.rowTitle}>{title}</p>
            <p className={styles.rowMeta}>
              <CalendarDays className={styles.rowMetaIcon} aria-hidden />
              {meta}
            </p>
          </>
        )}
      </div>
      <div className={styles.rowAction}>{action}</div>
    </li>
  );
}

export const SeriesLinkPanel = memo(function SeriesLinkPanel({
  token,
  candidate,
  seriesSiblings,
  onSelectCandidate,
  onSeriesUpdated
}: SeriesLinkPanelProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLUListElement>(null);

  const listingUrl =
    candidate.detailPageUrl ?? candidate.sourceUrl ?? candidate.normalizedEvent.externalUrl;
  const linkedIds = useMemo(() => new Set(seriesSiblings.map((row) => row.id)), [seriesSiblings]);

  const candidateQueries = useQueries({
    queries: LINK_SEARCH_STATUSES.map((status) => ({
      queryKey: ["admin", "candidates", "link-search", status, token],
      queryFn: () => listCandidates(token, status),
      staleTime: 60_000
    }))
  });

  const searchableCandidates = useMemo(() => {
    const byId = new Map<string, EventCandidate>();
    for (const result of candidateQueries) {
      for (const row of result.data?.items ?? []) {
        byId.set(row.id, row);
      }
    }
    return [...byId.values()];
  }, [candidateQueries]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) {
      return [];
    }
    return searchableCandidates
      .filter((row) => row.id !== candidate.id)
      .filter((row) => !linkedIds.has(row.id))
      .filter((row) => {
        const haystack = `${row.title} ${row.venueName} ${row.normalizedEvent.externalUrl ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      })
      .sort((left, right) => left.normalizedEvent.startTs.localeCompare(right.normalizedEvent.startTs))
      .slice(0, 8);
  }, [candidate.id, linkedIds, query, searchableCandidates]);

  useEffect(() => {
    if (matches.length > 0) {
      resultsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [matches.length, query]);

  const applySeriesResponse = (response: Awaited<ReturnType<typeof linkCandidatesAsSeries>>) => {
    queryClient.setQueryData(["admin", "candidate", candidate.id, token], response);
    onSeriesUpdated();
  };

  const linkMutation = useMutation({
    mutationFn: (otherCandidateId: string) => linkCandidatesAsSeries(token, candidate.id, otherCandidateId),
    onMutate: (otherCandidateId) => {
      setPendingActionId(otherCandidateId);
    },
    onSuccess: (response) => {
      applySeriesResponse(response);
    },
    onSettled: () => {
      setPendingActionId(null);
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: (unlinkId: string) => unlinkCandidateFromSeries(token, candidate.id, unlinkId),
    onMutate: (unlinkId) => {
      setPendingActionId(unlinkId);
    },
    onSuccess: (response) => {
      applySeriesResponse(response);
    },
    onSettled: () => {
      setPendingActionId(null);
    }
  });

  const isLoadingSearch = candidateQueries.some((result) => result.isLoading);
  const seriesName = candidate.normalizedEvent.seriesName;
  const seriesId = candidate.normalizedEvent.seriesId;

  return (
    <section className={styles.panel}>
      <h3 className={styles.heading}>{seriesSiblings.length > 0 ? "Linked dates" : "Series"}</h3>
      <div className={styles.meta}>
        {seriesName ? <p>{seriesName}</p> : null}
        {seriesId ? <p className={styles.seriesId}>{seriesId}</p> : null}
        {listingUrl ? (
          <a href={listingUrl} target="_blank" rel="noreferrer" className={styles.listingLink}>
            Listing page
            <ExternalLink className={styles.rowMetaIcon} aria-hidden />
          </a>
        ) : null}
      </div>

      {seriesSiblings.length > 0 ? (
        <ul className={styles.list}>
          {seriesSiblings.map((sib) => (
            <SeriesLinkRow
              key={sib.id}
              title={sib.title}
              meta={`${formatPacificDateTimeLabel(sib.startTs)} · ${sib.venueName} · ${sib.status}`}
              onOpen={() => onSelectCandidate(sib.id)}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pendingActionId !== null}
                  onClick={() => unlinkMutation.mutate(sib.id)}
                >
                  {pendingActionId === sib.id ? (
                    <Loader2 className={`${styles.rowMetaIcon} ${styles.spin}`} aria-hidden />
                  ) : (
                    <Unlink className={styles.rowMetaIcon} aria-hidden />
                  )}
                  Remove
                </Button>
              }
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No linked dates yet. Search below to add related events.</p>
      )}

      <div className={styles.searchSection}>
        <h4 className={styles.heading}>Link as series</h4>
        <p className={styles.searchHint}>
          Search pending or approved events. Linked dates move into the section above.
        </p>
        <div className={styles.searchField}>
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, venue, or URL"
          />
        </div>
        {isLoadingSearch && query.trim().length >= 2 ? (
          <p className={styles.loading}>Loading candidates…</p>
        ) : null}
        {matches.length > 0 ? (
          <ul ref={resultsRef} className={styles.list}>
            {matches.map((row) => (
              <SeriesLinkRow
                key={row.id}
                title={row.title}
                meta={`${formatPacificDateTimeLabel(row.normalizedEvent.startTs)} · ${row.venueName} · ${row.status}`}
                onOpen={() => onSelectCandidate(row.id)}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pendingActionId !== null}
                    onClick={() => linkMutation.mutate(row.id)}
                  >
                    {pendingActionId === row.id ? (
                      <Loader2 className={`${styles.rowMetaIcon} ${styles.spin}`} aria-hidden />
                    ) : (
                      <Link2 className={styles.rowMetaIcon} aria-hidden />
                    )}
                    Link
                  </Button>
                }
              />
            ))}
          </ul>
        ) : null}
        {linkMutation.error ? (
          <p className={styles.error}>
            {linkMutation.error instanceof Error ? linkMutation.error.message : "Link failed."}
          </p>
        ) : null}
        {unlinkMutation.error ? (
          <p className={styles.error}>
            {unlinkMutation.error instanceof Error ? unlinkMutation.error.message : "Remove failed."}
          </p>
        ) : null}
      </div>
    </section>
  );
});
