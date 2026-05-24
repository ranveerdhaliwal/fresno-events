create table public.seed_urls (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  label text,
  enabled boolean not null default true,
  notes text,
  br_crawl_job_id text,
  br_crawl_status text,
  br_crawl_started_at timestamptz,
  last_successful_crawl_at timestamptz,
  events_found_last_run integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seed_urls_enabled_idx on public.seed_urls (enabled) where enabled = true;

alter table public.seed_urls enable row level security;

insert into public.seed_urls (url, label) values
  ('https://towertheatrefresno.com/events', 'Tower Theatre'),
  ('https://www.fultonstreetfresno.com/events', 'Fulton Street Events'),
  ('https://www.savemart.center/events', 'Save Mart Center'),
  ('https://www.fresnofairgrounds.com/calendar', 'Big Fresno Fair'),
  ('https://www.cityoffresno.gov/parks/events/', 'City of Fresno Parks'),
  ('https://strummers.com/', 'Strummers'),
  ('https://www.valhallabar.com/events', 'Valhalla'),
  ('https://www.tiogasequoia.com/taproom-events', 'Tioga-Sequoia');
