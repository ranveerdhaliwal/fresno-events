create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  kind text not null,
  config jsonb not null default '{}'::jsonb,
  cadence_minutes int not null default 360,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_sources_kind_check check (kind in ('api', 'scrape', 'ai_discovery', 'manual'))
);

create index event_sources_enabled_idx on public.event_sources (enabled);

alter table public.event_sources enable row level security;

insert into public.event_sources (key, label, kind, config, cadence_minutes, enabled) values
  ('ticketmaster', 'Ticketmaster Discovery API', 'api', '{"radiusMiles": 50}'::jsonb, 360, true),
  ('seatgeek', 'SeatGeek API', 'api', '{"radiusMiles": 50}'::jsonb, 720, false),
  ('eventbrite', 'Eventbrite API', 'api', '{"radiusMiles": 50}'::jsonb, 720, false),
  ('bandsintown', 'Bandsintown API', 'api', '{}'::jsonb, 720, false),
  ('ai-discovery', 'AI discovery for no-API venues', 'ai_discovery', '{"urls": [], "maxPerUrl": 20}'::jsonb, 1440, false),
  ('fresno-curated', 'Curated Fresno venues and civic calendars', 'manual', '{}'::jsonb, 1440, false)
on conflict (key) do nothing;
