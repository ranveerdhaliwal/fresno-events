-- Source sync metadata (no tagline / what_to_know — derived at display time or via tags)
alter table public.events
  add column if not exists posted_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists source_sync_id text;
