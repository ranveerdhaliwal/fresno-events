-- Multi-lane ingest: seed_urls.lane + crawl_hints; events series/lineup

alter table public.seed_urls
  add column lane text not null default 'crawl'
    check (lane in ('api', 'special_url', 'crawl', 'manual')),
  add column crawl_hints jsonb not null default '{}'::jsonb;

create index seed_urls_lane_enabled_idx
  on public.seed_urls (lane, enabled) where enabled = true;

-- Soft-disable known-broken legacy rows (preserve crawl history)
update public.seed_urls set enabled = false where url in (
  'https://towertheatrefresno.com/events',
  'https://www.fultonstreetfresno.com/events'
);

-- Refined seeds (on conflict: leave existing row unchanged)
insert into public.seed_urls (url, label, lane, enabled, crawl_hints) values
  ('https://towertheatre.ticketsauce.com/', 'Tower Theatre', 'crawl', true, '{}'::jsonb),
  ('https://www.savemart.center/events', 'Save Mart Center', 'crawl', true, '{}'::jsonb),
  ('https://www.fresnofairgrounds.com/calendar', 'Big Fresno Fair', 'crawl', true, '{"extractorVariant":"festival","seriesId":"series:bigfresnofair:2026"}'::jsonb),
  ('https://gobulldogs.com/calendar', 'Fresno State Athletics', 'special_url', true, '{}'::jsonb),
  ('https://tmcasino.com/entertainment', 'Table Mountain Casino', 'crawl', true, '{"extractorVariant":"headline_only"}'::jsonb),
  ('https://www.fresnoconventioncenter.com/events', 'Fresno Convention Center', 'crawl', true, '{}'::jsonb),
  ('https://www.fresnochaffeezoo.org/events', 'Fresno Chaffee Zoo', 'crawl', true, '{}'::jsonb),
  ('https://www.fulton55.com/events', 'Fulton 55', 'crawl', true, '{}'::jsonb),
  ('https://strummers.com/', 'Strummers', 'crawl', true, '{}'::jsonb),
  ('https://www.rainbowballroom.com/events', 'Rainbow Ballroom', 'crawl', true, '{}'::jsonb),
  ('https://instagram.com/_placeholder_manual_', 'Instagram (manual)', 'manual', false, '{}'::jsonb)
on conflict (url) do nothing;

alter table public.events
  add column series_id text,
  add column series_name text,
  add column lineup jsonb;

create index events_series_id_idx on public.events (series_id) where series_id is not null;
