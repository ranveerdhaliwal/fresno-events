alter table public.event_candidates
  add column if not exists eventbrite_detail_status text,
  add column if not exists eventbrite_detail_fetched_at timestamptz;

alter table public.event_candidates
  drop constraint if exists event_candidates_eventbrite_detail_status_check;

alter table public.event_candidates
  add constraint event_candidates_eventbrite_detail_status_check check (
    eventbrite_detail_status is null
    or eventbrite_detail_status in ('fetched', 'blocked', 'error')
  );

comment on column public.event_candidates.eventbrite_detail_status is
  'null = EB detail not yet visited (or row has no EB url); fetched = EB detail page parsed and merged; blocked = 403/captcha; error = fetch/parse failure.';

comment on column public.event_candidates.eventbrite_detail_fetched_at is
  'When eventbrite_detail_status was last set by the EB detail backfill job.';
