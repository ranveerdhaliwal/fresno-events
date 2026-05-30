-- Cross-source occurrence linking (one occurrence_id per real-world show).

alter table public.event_candidates
  add column if not exists occurrence_id uuid not null default gen_random_uuid(),
  add column if not exists occurrence_key text,
  add column if not exists url_key text,
  add column if not exists canonical_candidate_id uuid references public.event_candidates (id) on delete set null;

create index if not exists event_candidates_occurrence_id_idx
  on public.event_candidates (occurrence_id);

create index if not exists event_candidates_occurrence_key_idx
  on public.event_candidates (occurrence_key)
  where occurrence_key is not null;

create index if not exists event_candidates_url_key_idx
  on public.event_candidates (url_key)
  where url_key is not null;

create index if not exists event_candidates_canonical_candidate_id_idx
  on public.event_candidates (canonical_candidate_id)
  where canonical_candidate_id is not null;

comment on column public.event_candidates.occurrence_id is
  'Shared id for the same real-world event across ingest sources.';
comment on column public.event_candidates.occurrence_key is
  'Finder hash: normalized title + Pacific time bucket + venue.';
comment on column public.event_candidates.url_key is
  'Finder hash: normalized ticket or external URL host+path.';
comment on column public.event_candidates.canonical_candidate_id is
  'Non-primary rows point at the review-queue primary for this occurrence.';

alter table public.events
  add column if not exists occurrence_id uuid,
  add column if not exists occurrence_key text;

create index if not exists events_occurrence_id_idx
  on public.events (occurrence_id)
  where occurrence_id is not null;

comment on column public.events.occurrence_id is
  'Same occurrence group as linked event_candidates; partial unique added after backfill.';
