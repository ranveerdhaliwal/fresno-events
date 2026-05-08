create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table public.images (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null,
  cdn_url text not null,
  width int,
  height int,
  blurhash text,
  dominant_color text,
  alt_text text,
  source_url text,
  license text,
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  city text not null,
  neighborhood text,
  lat double precision,
  lng double precision,
  capacity int,
  website text,
  phone text,
  socials jsonb not null default '{}'::jsonb,
  hero_image_id uuid references public.images(id) on delete set null,
  description text,
  primary_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  genres text[] not null default '{}',
  hero_image_id uuid references public.images(id) on delete set null,
  bio text,
  spotify_id text,
  bandsintown_id text,
  musicbrainz_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  source text not null,
  source_event_id text,
  source_refs jsonb not null default '{}'::jsonb,
  title text not null,
  description_html text,
  description_text text,
  description_tsvector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description_text, ''))
  ) stored,
  venue_id uuid not null references public.venues(id) on delete restrict,
  start_ts timestamptz not null,
  end_ts timestamptz,
  timezone text not null default 'America/Los_Angeles',
  doors_ts timestamptz,
  category text not null,
  subcategories text[] not null default '{}',
  tags text[] not null default '{}',
  price_min numeric,
  price_max numeric,
  currency text not null default 'USD',
  is_free boolean,
  ticket_url text,
  age_restriction text,
  status text not null default 'scheduled',
  hero_image_id uuid references public.images(id) on delete set null,
  gallery_image_ids uuid[] not null default '{}',
  primary_artist_id uuid references public.artists(id) on delete set null,
  all_artist_ids uuid[] not null default '{}',
  external_url text,
  dedupe_hash text,
  confidence_score real,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_source_event_unique unique (source, source_event_id),
  constraint events_dedupe_hash_unique unique (dedupe_hash)
);

create table public.user_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  liked_categories text[] not null default '{}',
  liked_venues uuid[] not null default '{}',
  liked_artists uuid[] not null default '{}',
  notification_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rrule text not null,
  venue_id uuid references public.venues(id) on delete set null,
  category text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_start_category_idx on public.events (start_ts, category);
create index events_venue_start_idx on public.events (venue_id, start_ts);
create index events_last_seen_idx on public.events (last_seen_at);
create index events_tags_gin_idx on public.events using gin (tags);
create index events_description_tsvector_gin_idx on public.events using gin (description_tsvector);
create index events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create index venues_city_neighborhood_idx on public.venues (city, neighborhood);

alter table public.images enable row level security;
alter table public.venues enable row level security;
alter table public.artists enable row level security;
alter table public.events enable row level security;
alter table public.user_saves enable row level security;
alter table public.user_preferences enable row level security;
alter table public.recurring_events enable row level security;

create policy "Public read images" on public.images for select using (true);
create policy "Public read venues" on public.venues for select using (true);
create policy "Public read artists" on public.artists for select using (true);
create policy "Public read scheduled events" on public.events for select using (status in ('scheduled', 'sold_out', 'postponed'));
create policy "Public read recurring events" on public.recurring_events for select using (true);

create policy "Users manage their saves" on public.user_saves
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their preferences" on public.user_preferences
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
