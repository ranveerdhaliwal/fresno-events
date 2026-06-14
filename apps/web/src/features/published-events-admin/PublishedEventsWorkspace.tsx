import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, LogOut, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/Button/Button";
import { SelectInput } from "@/components/SelectInput/SelectInput";
import { Text } from "@/components/Text";
import { EVENT_DISPLAY_PRIORITY } from "@fresno-events/shared";

import { adminKeys } from "@/features/admin/admin.queryKeys";
import {
  AdminApiError,
  bulkSetPublishedEventPriority,
  getPublishedEvent,
  isAdminAuthError,
  listPublishedEvents
} from "@/features/admin/admin-api";
import { AdminSearchInput } from "@/features/admin-review/AdminSearchInput";
import { DetailLoading } from "@/components/DetailLoading";
import { ErrorBanner } from "@/components/ErrorBanner";
import { togglePageSelection } from "@/features/admin-review/admin-review-selection.utils";
import styles from "@/features/admin-review/AdminReviewWorkspace.module.css";

import { PublishedEventDetail } from "./PublishedEventDetail";
import { PublishedEventList } from "./PublishedEventList";
import {
  filterPublishedEventsForSearch,
  groupPublishedEventsByPriority
} from "./published-events-admin.utils";

const PAGE_SIZE = 50;

type EventsScope = "future" | "past" | "all";

const SCOPE_TABS: Array<{ id: EventsScope; label: string }> = [
  { id: "future", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" }
];

export interface PublishedEventsWorkspaceProps {
  token: string;
  selectedEventId: string | null;
  onChangeToken: () => void;
  onAuthFailure: () => void;
}

function EmptyPublishedDetail() {
  return (
    <div className={styles.detailPanePlaceholder}>
      <p>Select a published event from the list to edit it on the live site.</p>
    </div>
  );
}

export function PublishedEventsWorkspace({
  token,
  selectedEventId,
  onChangeToken,
  onAuthFailure
}: PublishedEventsWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<EventsScope>("future");
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPriority, setBulkPriority] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const searchActive = searchQuery.trim().length >= 2;

  const listQuery = useQuery({
    queryKey: adminKeys.publishedEventsList(scope, offset, searchQuery),
    queryFn: () =>
      listPublishedEvents(token, {
        limit: PAGE_SIZE,
        offset,
        scope,
        ...(searchActive ? { q: searchQuery } : {})
      }),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !isAdminAuthError(error) && failureCount < 1
  });

  useEffect(() => {
    if (isAdminAuthError(listQuery.error)) {
      onAuthFailure();
    }
  }, [listQuery.error, onAuthFailure]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkPriority("");
    setActionMessage(null);
  }, [scope, offset]);

  const items = listQuery.data?.items ?? [];

  const filteredItems = useMemo(() => {
    if (!searchActive) {
      return items;
    }
    return filterPublishedEventsForSearch(items, searchQuery);
  }, [items, searchActive, searchQuery]);

  const listGroups = useMemo(
    () => groupPublishedEventsByPriority(filteredItems),
    [filteredItems]
  );

  const activeId = selectedEventId;

  const onSelect = useCallback(
    (id: string) => {
      void navigate({ to: "/admin/events/$eventId", params: { eventId: id } });
    },
    [navigate]
  );

  const eventQuery = useQuery({
    queryKey: adminKeys.publishedEvent(activeId ?? ""),
    queryFn: () => getPublishedEvent(token, activeId!),
    enabled: Boolean(activeId),
    retry: false
  });

  useEffect(() => {
    if (eventQuery.error && isAdminAuthError(eventQuery.error)) {
      onAuthFailure();
    }
  }, [eventQuery.error, onAuthFailure]);

  const bulkPriorityMutation = useMutation({
    mutationFn: ({ ids, priority }: { ids: string[]; priority: number }) =>
      bulkSetPublishedEventPriority(token, ids, priority),
    onSuccess: (result) => {
      const parts = [`Updated priority on ${result.updated} event(s).`];
      if (result.failed.length > 0) {
        parts.push(`${result.failed.length} failed.`);
      }
      setActionMessage(parts.join(" "));
      setSelectedIds(new Set());
      setBulkPriority("");
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "published-events"] });
      if (activeId) {
        void queryClient.invalidateQueries({ queryKey: adminKeys.publishedEvent(activeId) });
      }
    },
    onError: (error: unknown) => {
      setActionMessage(error instanceof AdminApiError ? error.message : "Bulk priority update failed.");
    }
  });

  const bulkActionPending = bulkPriorityMutation.isPending;
  const total = listQuery.data?.total ?? 0;
  const canGoBack = offset > 0;
  const canGoForward = offset + PAGE_SIZE < total;

  const handleSelectAllPage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => togglePageSelection(prev, pageIds));
  }, []);

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <Text variant="eyebrow">Admin</Text>
          <Text variant="header1" className={styles.title}>
            Live events
          </Text>
          <Text variant="body1" tone="mutedOnPage" className={styles.subtitle}>
            Edit published events on the site — same layout as the review queue.
          </Text>
          <AdminSearchInput
            onDebouncedChange={handleSearchChange}
            placeholder="Search published events by title, venue, or source…"
            ariaLabel="Search published events"
          />
          <div className={styles.tabRow}>
            {SCOPE_TABS.map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={scope === tab.id ? "approve" : "secondary"}
                onClick={() => {
                  setScope(tab.id);
                  setOffset(0);
                  void navigate({ to: "/admin/events" });
                }}
              >
                {tab.label}
                {scope === tab.id && listQuery.data ? ` (${listQuery.data.total})` : ""}
              </Button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" onClick={() => listQuery.refetch()}>
            <RefreshCcw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={onChangeToken}>
            <LogOut className="size-3.5" aria-hidden />
            Change token
          </Button>
        </div>
      </header>

      {listQuery.isError && !isAdminAuthError(listQuery.error) ? (
        <ErrorBanner error={listQuery.error} />
      ) : null}

      {actionMessage ? (
        <Text variant="body1" tone="onCard" className={styles.message}>
          {actionMessage}
        </Text>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className={styles.bulkBar}>
          <span className={styles.bulkBarLabel}>{selectedIds.size} selected</span>
          <label className={styles.bulkPriorityField}>
            <span className={styles.bulkPriorityLabel}>Priority</span>
            <SelectInput
              className={styles.bulkPrioritySelect}
              value={bulkPriority}
              onChange={(event) => setBulkPriority(event.target.value)}
              aria-label="Bulk display priority"
            >
              <option value="" disabled>
                Choose priority…
              </option>
              {EVENT_DISPLAY_PRIORITY.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  P{tier.value} — {tier.label}
                </option>
              ))}
            </SelectInput>
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkActionPending || bulkPriority === ""}
            onClick={() => {
              const priority = Number(bulkPriority);
              if (
                window.confirm(
                  `Set priority P${priority} on ${selectedIds.size} selected published event(s)?`
                )
              ) {
                bulkPriorityMutation.mutate({ ids: [...selectedIds], priority });
              }
            }}
          >
            {bulkPriorityMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Set priority
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedIds(new Set());
              setBulkPriority("");
            }}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.listCol}>
          <PublishedEventList
            groups={listGroups}
            activeId={activeId}
            isLoading={listQuery.isLoading}
            onSelect={onSelect}
            selectedIds={selectedIds}
            searchMode={searchActive}
            searchQuery={searchQuery}
            onToggleSelected={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              });
            }}
            onSelectAll={handleSelectAllPage}
          />
          {total > PAGE_SIZE ? (
            <div className={styles.pager}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canGoBack || listQuery.isFetching}
                onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              >
                <ChevronLeft size={14} aria-hidden />
                Previous
              </Button>
              <span className={styles.pagerMeta}>
                {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canGoForward || listQuery.isFetching}
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
              >
                Next
                <ChevronRight size={14} aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>

        <div className={styles.detailCol}>
          <section className={styles.detailPane}>
            {!activeId ? (
              <EmptyPublishedDetail />
            ) : eventQuery.isLoading ? (
              <DetailLoading />
            ) : eventQuery.isError ? (
              <ErrorBanner error={eventQuery.error} />
            ) : eventQuery.data ? (
              <PublishedEventDetail
                token={token}
                detail={eventQuery.data}
                onSaved={() => {
                  void listQuery.refetch();
                }}
              />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
