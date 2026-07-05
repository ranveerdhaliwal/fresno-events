-- One scheduled event per occurrence_id (cross-source dedupe publish guard).
-- Run published-orphan cleanup before applying if duplicate published rows exist.

create unique index if not exists events_occurrence_id_scheduled_unique
  on public.events (occurrence_id)
  where status = 'scheduled' and occurrence_id is not null;
