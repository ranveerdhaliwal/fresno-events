alter table public.event_candidates
  add column suggested_priority smallint
  check (suggested_priority between 0 and 5);

comment on column public.event_candidates.suggested_priority is
  'AI/editorial hint. 0=ads (reserved), 1=biggest, 2=major, 3=exciting, 4=notable, 5=default. Null = not enriched yet.';
