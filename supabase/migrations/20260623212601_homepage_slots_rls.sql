-- homepage_slots was created without RLS; Supabase flags rls_disabled_in_public.
-- Public read (slot → event_id mapping); writes stay service_role via API worker only.

alter table public.homepage_slots enable row level security;

create policy "Public read homepage slots"
  on public.homepage_slots
  for select
  using (true);
