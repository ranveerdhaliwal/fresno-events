-- Allow a sixth homepage slot (featured grid is 2 heroes + 4 small).
alter table public.homepage_slots
  drop constraint if exists homepage_slots_position_check;

alter table public.homepage_slots
  add constraint homepage_slots_position_check check (position between 1 and 6);

insert into public.homepage_slots (section, position, event_id)
select s.section, 6, null
from (values ('featured'), ('popular')) as s(section)
on conflict do nothing;
