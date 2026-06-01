create table public.homepage_slots (
  section text not null check (section in ('featured', 'popular')),
  position int not null check (position between 1 and 5),
  event_id uuid references public.events(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (section, position)
);

insert into public.homepage_slots (section, position, event_id)
select s.section, p.position, null
from (values ('featured'), ('popular')) as s(section)
cross join generate_series(1, 5) as p(position)
on conflict do nothing;
