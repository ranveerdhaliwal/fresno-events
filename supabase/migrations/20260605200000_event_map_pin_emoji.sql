alter table public.events
  add column if not exists map_pin_emoji text;

comment on column public.events.map_pin_emoji is 'Map marker emoji override; null = auto-detect; pin = default Leaflet marker';
