alter table public.event_candidates
  add column if not exists content_fingerprint text;

comment on column public.event_candidates.content_fingerprint is
  'SHA-256 of stable normalized event fields; used to detect source changes without re-queueing unchanged rows.';

create index if not exists event_candidates_content_fingerprint_idx
  on public.event_candidates (content_fingerprint)
  where content_fingerprint is not null;
