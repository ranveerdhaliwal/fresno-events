create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  events_found int not null default 0,
  errors_count int not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ingest_runs(id) on delete set null,
  source text not null,
  source_event_id text not null,
  title text not null,
  venue_name text not null,
  start_ts timestamptz not null,
  source_url text,
  ticket_url text,
  normalized_event jsonb not null,
  raw_payload jsonb not null default '{}'::jsonb,
  dedupe_hash text not null,
  confidence_score real not null default 0.7,
  status text not null default 'pending_review',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  matched_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_candidates_source_event_unique unique (source, source_event_id),
  constraint event_candidates_dedupe_hash_unique unique (dedupe_hash),
  constraint event_candidates_status_check check (status in ('pending_review', 'approved', 'rejected', 'needs_changes', 'duplicate'))
);

create index ingest_runs_source_started_idx on public.ingest_runs (source, started_at desc);
create index event_candidates_status_start_idx on public.event_candidates (status, start_ts);
create index event_candidates_source_idx on public.event_candidates (source, source_event_id);
create index event_candidates_title_trgm_idx on public.event_candidates using gin (title gin_trgm_ops);

alter table public.ingest_runs enable row level security;
alter table public.event_candidates enable row level security;
