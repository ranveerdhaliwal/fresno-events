alter table public.event_candidates
  add column if not exists detail_status text not null default 'pending',
  add column if not exists detail_page_url text;

alter table public.event_candidates drop constraint if exists event_candidates_detail_status_check;

alter table public.event_candidates
  add constraint event_candidates_detail_status_check check (
    detail_status in ('complete', 'pending')
  );

comment on column public.event_candidates.detail_status is
  'complete = normalized_event has enough fields for review without another detail fetch; pending = detail_page_url should be fetched/parsed by a backfill job.';

comment on column public.event_candidates.detail_page_url is
  'Canonical show/detail URL to fetch when detail_status is pending (may match source_url / normalized_event.externalUrl).';

create index if not exists event_candidates_detail_pending_idx
  on public.event_candidates (detail_status, updated_at desc)
  where detail_status = 'pending';
