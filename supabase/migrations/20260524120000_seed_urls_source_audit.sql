-- Operator URL audit: correct crawl targets + shallow/ticketsauce providers; disable broken seeds.

update public.seed_urls
set enabled = false
where url in (
  'https://www.cityoffresno.gov/parks/events/',
  'https://www.tiogasequoia.com/taproom-events',
  'https://www.valhallabar.com/events',
  'https://www.fresnochaffeezoo.org/events',
  'https://www.fresnoconventioncenter.com/events',
  'https://www.savemart.center/events',
  'https://www.fulton55.com/events',
  'https://strummers.com/',
  'https://www.rainbowballroom.com/events',
  'https://www.fresnofairgrounds.com/calendar'
);

update public.seed_urls
set
  url = 'https://events.fresnoconventioncenter.com/',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where url = 'https://www.fresnoconventioncenter.com/events'
   or label = 'Fresno Convention Center';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://events.fresnoconventioncenter.com/',
  'Fresno Convention Center',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints,
    lane = excluded.lane;

update public.seed_urls
set
  url = 'https://www.savemartcenter.com/events-tickets/?bounds=false&view=list&sort=date',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where label = 'Save Mart Center';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://www.savemartcenter.com/events-tickets/?bounds=false&view=list&sort=date',
  'Save Mart Center',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set
  url = 'https://fcz.org/events/',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where label = 'Fresno Chaffee Zoo';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://fcz.org/events/',
  'Fresno Chaffee Zoo',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set
  url = 'https://fulton55.com/',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where label = 'Fulton 55';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://fulton55.com/',
  'Fulton 55',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set
  url = 'https://www.strummersclub.com/shows',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where label = 'Strummers';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://www.strummersclub.com/shows',
  'Strummers',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set
  url = 'https://www.rainbowballroom.com/blog-grid',
  crawl_hints = '{"provider":"listing_page"}'::jsonb,
  enabled = true
where label = 'Rainbow Ballroom';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://www.rainbowballroom.com/blog-grid',
  'Rainbow Ballroom',
  'crawl',
  true,
  '{"provider":"listing_page"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set
  url = 'https://www.fresnofair.com/',
  crawl_hints = '{"provider":"festival","extractorVariant":"festival","seriesId":"series:bigfresnofair:2026"}'::jsonb,
  enabled = true
where label = 'Big Fresno Fair';

insert into public.seed_urls (url, label, lane, enabled, crawl_hints)
values (
  'https://www.fresnofair.com/',
  'Big Fresno Fair',
  'crawl',
  true,
  '{"provider":"festival","extractorVariant":"festival","seriesId":"series:bigfresnofair:2026"}'::jsonb
)
on conflict (url) do update
set enabled = excluded.enabled,
    crawl_hints = excluded.crawl_hints;

update public.seed_urls
set crawl_hints = '{"provider":"ticketsauce","horizonMonths":6}'::jsonb
where url = 'https://towertheatre.ticketsauce.com/';

update public.seed_urls
set crawl_hints = '{"provider":"headline_only","extractorVariant":"headline_only"}'::jsonb
where url = 'https://tmcasino.com/entertainment';
