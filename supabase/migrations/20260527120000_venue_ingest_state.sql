-- Venue ingest operational state (replaces seed_urls for crawl tracking).

create table public.venue_ingest_state (
  venue_key text primary key,
  last_ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  br_crawl_job_id text,
  br_crawl_status text,
  br_crawl_started_at timestamptz,
  events_found_last_run integer,
  listing_urls_found integer,
  detail_urls_visited integer,
  debug jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.venue_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  venue_key text not null,
  ingest_run_id uuid not null references public.ingest_runs (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  events_found integer not null default 0,
  br_crawl_job_id text,
  br_crawl_status text,
  debug jsonb not null default '{}'::jsonb
);

create index venue_ingest_runs_venue_started_idx
  on public.venue_ingest_runs (venue_key, started_at desc);

create index venue_ingest_runs_ingest_run_idx
  on public.venue_ingest_runs (ingest_run_id);

alter table public.venue_ingest_state enable row level security;
alter table public.venue_ingest_runs enable row level security;
