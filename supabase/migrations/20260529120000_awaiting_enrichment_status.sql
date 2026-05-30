-- Candidates stay off the admin review queue until post-ingest enrichment promotes them.
alter table public.event_candidates drop constraint if exists event_candidates_status_check;

alter table public.event_candidates
  add constraint event_candidates_status_check check (
    status in (
      'awaiting_enrichment',
      'pending_review',
      'approved',
      'rejected',
      'needs_changes',
      'duplicate'
    )
  );
