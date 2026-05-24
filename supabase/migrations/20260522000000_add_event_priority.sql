alter table public.events
  add column priority smallint not null default 5
  check (priority between 0 and 5);

create index events_priority_start_ts_idx
  on public.events (priority asc, start_ts asc)
  where status in ('scheduled', 'sold_out', 'postponed');

comment on column public.events.priority is
  'Editorial display priority. 0=ads/sponsored, 1=biggest, 2=major, 3=exciting, 4=notable, 5=default. Sort ascending.';
