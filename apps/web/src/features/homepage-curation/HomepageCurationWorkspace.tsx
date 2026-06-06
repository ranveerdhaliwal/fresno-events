import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { adminKeys } from "@/features/admin/admin.queryKeys";
import { getHomepageSlots, isAdminAuthError, saveHomepageSlots, searchPublishedEvents } from "@/features/admin/admin-api";
import { FormField } from "@/components/FormField/FormField";
import { TextInput } from "@/components/TextInput/TextInput";
import { ErrorBanner } from "@/features/admin-review/AdminReviewDetail.shared";
import { broadcastAdminCache } from "@/features/admin-mode/admin-cache";
import { formatPacificDateTimeLabel } from "@/lib/pacific-time";
import { cn } from "@/lib/cn";
import type { AdminEventSearchHit, HomepageSection, HomepageSlotRow } from "@fresno-events/shared";

import styles from "./HomepageCurationWorkspace.module.css";

const SECTIONS: Array<{ id: HomepageSection; label: string; positions: number[] }> = [
  { id: "featured", label: "Featured grid", positions: [1, 2, 3, 4, 5] },
  { id: "popular", label: "Popular sidebar", positions: [1, 2, 3, 4, 5] }
];

interface DraftSlot {
  section: HomepageSection;
  position: number;
  eventId: string | null;
  event: HomepageSlotRow["event"];
  stale: boolean;
}

interface HomepageCurationWorkspaceProps {
  token: string;
  onAuthFailure: () => void;
}

export function HomepageCurationWorkspace({ token, onAuthFailure }: HomepageCurationWorkspaceProps) {
  const queryClient = useQueryClient();
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [reviewerName, setReviewerName] = useState(() => sessionStorage.getItem("wuf:admin_name") ?? "");
  const [activeSearch, setActiveSearch] = useState<{ section: HomepageSection; position: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const slotsQuery = useQuery({
    queryKey: adminKeys.homepageSlots(),
    queryFn: () => getHomepageSlots(token),
    retry: false
  });

  useEffect(() => {
    if (slotsQuery.error && isAdminAuthError(slotsQuery.error)) {
      onAuthFailure();
    }
  }, [slotsQuery.error, onAuthFailure]);

  useEffect(() => {
    if (slotsQuery.data) {
      setDraftSlots(
        slotsQuery.data.slots.map((slot) => ({
          section: slot.section,
          position: slot.position,
          eventId: slot.eventId,
          event: slot.event,
          stale: slot.stale
        }))
      );
    }
  }, [slotsQuery.data]);

  useEffect(() => {
    if (reviewerName) {
      sessionStorage.setItem("wuf:admin_name", reviewerName);
    }
  }, [reviewerName]);

  const searchResultsQuery = useQuery({
    queryKey: adminKeys.eventSearch(searchQuery, "future"),
    queryFn: () => searchPublishedEvents(token, searchQuery, { limit: 8, scope: "future" }),
    enabled: searchQuery.trim().length >= 2,
    retry: false
  });

  const staleCount = useMemo(() => draftSlots.filter((slot) => slot.eventId && slot.stale).length, [draftSlots]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveHomepageSlots(token, {
        slots: draftSlots.map(({ section, position, eventId }) => ({ section, position, eventId })),
        ...(reviewerName.trim() ? { reviewedBy: reviewerName.trim() } : {})
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.homepageSlots(), data);
      setDraftSlots(
        data.slots.map((slot) => ({
          section: slot.section,
          position: slot.position,
          eventId: slot.eventId,
          event: slot.event,
          stale: slot.stale
        }))
      );
      broadcastAdminCache({ type: "homepage-updated" });
    },
    onError: (error) => {
      if (isAdminAuthError(error)) {
        onAuthFailure();
      }
    }
  });

  const assignEvent = (hit: AdminEventSearchHit) => {
    if (!activeSearch) return;

    setDraftSlots((current) =>
      current.map((slot) => {
        if (slot.section === activeSearch.section && slot.position === activeSearch.position) {
          return {
            ...slot,
            eventId: hit.id,
            event: {
              id: hit.id,
              slug: hit.slug,
              title: hit.title,
              startTs: hit.startTs,
              status: "scheduled",
              heroImageUrl: hit.heroImageUrl
            },
            stale: false
          };
        }
        return slot;
      })
    );
    setActiveSearch(null);
    setSearchQuery("");
  };

  const clearSlot = (section: HomepageSection, position: number) => {
    setDraftSlots((current) =>
      current.map((slot) =>
        slot.section === section && slot.position === position
          ? { ...slot, eventId: null, event: null, stale: false }
          : slot
      )
    );
  };

  if (slotsQuery.isLoading) {
    return (
      <div className={styles.loading}>
        <Loader2 className="size-5 animate-spin" />
        Loading homepage slots…
      </div>
    );
  }

  if (slotsQuery.error && !isAdminAuthError(slotsQuery.error)) {
    return <ErrorBanner error={slotsQuery.error} />;
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Homepage curation</p>
          <h1 className={styles.title}>Pin featured & popular slots</h1>
          <p className={styles.subtitle}>
            Empty slots auto-fill from the event pool. Pinned events stay visible even when tabs filter the homepage.
          </p>
        </div>
        <div className={styles.actions}>
          <FormField label="Reviewer">
            <TextInput
              value={reviewerName}
              onChange={(event) => setReviewerName(event.target.value)}
              placeholder="your name"
            />
          </FormField>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={styles.saveBtn}
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save slots
          </button>
        </div>
      </header>

      {staleCount > 0 ? (
        <div className={styles.staleBanner}>
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {staleCount} pinned {staleCount === 1 ? "slot is" : "slots are"} stale (past or ineligible). Clear or replace them before saving.
          </span>
        </div>
      ) : null}

      {saveMutation.error ? <ErrorBanner error={saveMutation.error} /> : null}

      <div className={styles.sections}>
        {SECTIONS.map((section) => (
          <section key={section.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.label}</h2>
            <div className={styles.slotGrid}>
              {section.positions.map((position) => {
                const slot = draftSlots.find((entry) => entry.section === section.id && entry.position === position);
                const isSearching =
                  activeSearch?.section === section.id && activeSearch.position === position;

                return (
                  <div key={`${section.id}-${position}`} className={styles.slot}>
                    <div className={styles.slotHead}>
                      <span className={styles.slotLabel}>Slot {position}</span>
                      {slot?.eventId ? (
                        <button
                          type="button"
                          className={styles.clearBtn}
                          onClick={() => clearSlot(section.id, position)}
                          aria-label="Clear slot"
                        >
                          <X className="size-3" />
                        </button>
                      ) : null}
                    </div>

                    {slot?.event ? (
                      <div className={cn(styles.eventCard, slot.stale && styles.eventStale)}>
                        <p className={styles.eventTitle}>{slot.event.title}</p>
                        <p className={styles.eventMeta}>{formatPacificDateTimeLabel(slot.event.startTs)}</p>
                        {slot.stale ? (
                          <p className={styles.staleLabel}>
                            <AlertTriangle className="size-3" /> Stale pin
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className={styles.emptySlot}>Auto-fill</p>
                    )}

                    <button
                      type="button"
                      className={styles.searchToggle}
                      onClick={() => {
                        setActiveSearch(isSearching ? null : { section: section.id, position });
                        setSearchQuery("");
                      }}
                    >
                      <Search className="size-3" />
                      {isSearching ? "Close search" : slot?.eventId ? "Replace" : "Pin event"}
                    </button>

                    {isSearching ? (
                      <div className={styles.searchPanel}>
                        <TextInput
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search published events…"
                          autoFocus
                        />
                        {searchResultsQuery.isFetching ? (
                          <p className={styles.searchHint}>Searching…</p>
                        ) : null}
                        {searchResultsQuery.error ? <ErrorBanner error={searchResultsQuery.error} /> : null}
                        <ul className={styles.searchResults}>
                          {(searchResultsQuery.data?.items ?? []).map((hit) => (
                            <li key={hit.id}>
                              <button type="button" className={styles.searchHit} onClick={() => assignEvent(hit)}>
                                <span className={styles.hitTitle}>{hit.title}</span>
                                <span className={styles.hitMeta}>
                                  {hit.venueName} · {formatPacificDateTimeLabel(hit.startTs)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {searchQuery.trim().length >= 2 &&
                        !searchResultsQuery.isFetching &&
                        (searchResultsQuery.data?.items.length ?? 0) === 0 ? (
                          <p className={styles.searchHint}>No matching events.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
