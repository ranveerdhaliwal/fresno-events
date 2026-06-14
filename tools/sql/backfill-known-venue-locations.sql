-- One-time local backfill: fill missing venueAddress/venueLat on event_candidates.
-- Mirrors workers/ingest/src/lib/known-venue-location.utils.ts

CREATE OR REPLACE FUNCTION pg_temp.patch_known_venue(ne jsonb, addr text, city text, lat double precision, lng double precision)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT ne
    || CASE WHEN coalesce(ne->>'venueAddress','') = '' THEN jsonb_build_object('venueAddress', addr) ELSE '{}'::jsonb END
    || CASE WHEN coalesce(ne->>'venueCity','') = '' THEN jsonb_build_object('venueCity', city) ELSE '{}'::jsonb END
    || CASE WHEN ne->>'venueLat' IS NULL OR ne->>'venueLat' = 'null' THEN jsonb_build_object('venueLat', lat) ELSE '{}'::jsonb END
    || CASE WHEN ne->>'venueLng' IS NULL OR ne->>'venueLng' = 'null' THEN jsonb_build_object('venueLng', lng) ELSE '{}'::jsonb END;
$$;

WITH rules(pattern, addr, city, lat, lng) AS (
  VALUES
    ('%rainbow%ballroom%', '1725 Broadway St', 'Fresno', 36.7402635, -119.7994878),
    ('%strummer%', '833 E Fern Ave', 'Fresno', 36.7589629, -119.8002377),
    ('%fulton%55%', '875 Divisadero St', 'Fresno', 36.7437782, -119.8005388),
    ('%save%mart%center%', '2650 E. Shaw Ave', 'Fresno', 36.8096959, -119.738519),
    ('%tower%theatre%', '815 E Olive Ave', 'Fresno', 36.7579827, -119.8014524),
    ('%chaffee%zoo%', '894 W. Belmont Avenue', 'Fresno', 36.7519, -119.8235),
    ('%saroyan%', '730 M St', 'Fresno', 36.7347, -119.7847),
    ('%convention%center%', '848 M Street', 'Fresno', 36.7346, -119.7853),
    ('%chukchansi%park%', '1800 Tulare St', 'Fresno', 36.7328, -119.7902),
    ('%warnors%', '1400 Fulton St', 'Fresno', 36.7384472, -119.7945803),
    ('%cmac%', '1555 Van Ness Ave', 'Fresno', 36.7402201, -119.795774),
    ('%arte%americas%', '1630 Van Ness Ave', 'Fresno', 36.7411734, -119.7958592),
    ('%tioga%sequoia%', '745 Fulton St', 'Fresno', 36.7318, -119.7871),
    ('%memorial%auditorium%', '2425 Fresno St', 'Fresno', 36.73972, -119.7875),
    ('%north%gym%', '5305 N. Campus Drive', 'Fresno', 36.8133, -119.7412),
    ('%switch%lounge%', '5665 N Blackstone Ave', 'Fresno', 36.8214, -119.7908),
    ('%press box sports (pb1) ne fresno%', '6022 N Figarden Dr', 'Fresno', 36.8233848, -119.8696978),
    ('%kern st between m and n streets%', 'Kern St between M and N Streets', 'Fresno', 36.7361012, -119.7852997),
    ('%old town clovis%', 'Pollasky between 5th and Bullard', 'Clovis', 36.8194467, -119.7020549),
    ('%woodward park%', '9407 N Fort Washington', 'Fresno', 36.8721, -119.7849),
    ('%fashion fair mall%', '645 E Shaw Ave', 'Fresno', 36.8065701, -119.7767257),
    ('%river park farmer''s market%', '220 Paseo del Centro', 'Fresno', 36.7377981, -119.7871247),
    ('%clovis veterans memorial district%', '808 4th Street', 'Clovis', 36.8243539, -119.6986866),
    ('%the rosé%', '820 Van Ness Ave', 'Fresno', 36.7331718, -119.7870177),
    ('%the next bar%', '4231 E Shields Ave', 'Fresno', 36.7801259, -119.7533038),
    ('%crow & wolf brewing company%', '526 Spruce Avenue', 'Clovis', 36.8407625, -119.7043663),
    ('%maya cinemas%', '3090 E Campus Pointe Dr', 'Fresno', 36.8119807, -119.734641),
    ('%ramos torres winery%', '1665 Simpson St', 'Kingsburg', 36.5150906, -119.5561857),
    ('%vineyard farmer''s market%', 'Northwest Corner of Blackstone and Shaw', 'Fresno', 36.8084559, -119.7903245),
    ('%rocket dog%', '88 E Shaw Ave.', 'Fresno', 36.8088311, -119.7884699),
    ('%7300 n. fresno street%', '7300 N. Fresno Street', 'Fresno', 36.8428404, -119.7811198),
    ('%eaton plaza%', '2400 Fresno St', 'Fresno', 36.738775, -119.7881974),
    ('%fresno ag hardware%', '4590 N First St', 'Fresno', 36.8004176, -119.7706516),
    ('%2600 fresno st, fresno, ca 93721, usa%', '2600 Fresno St', 'Fresno', 36.7396038, -119.7843193)
)
UPDATE event_candidates ec
SET normalized_event = pg_temp.patch_known_venue(ec.normalized_event, r.addr, r.city, r.lat, r.lng)
FROM rules r
WHERE lower(ec.normalized_event->>'venueName') LIKE r.pattern
  AND (
    coalesce(ec.normalized_event->>'venueAddress','') = ''
    OR ec.normalized_event->>'venueLat' IS NULL
  );

UPDATE venues SET address = '875 Divisadero St, Fresno, CA 93721', lat = 36.7437782, lng = -119.8005388
WHERE name = 'Fulton 55' AND coalesce(address,'') = '';

UPDATE venues SET address = '2425 Fresno St, Fresno, CA 93721', lat = 36.73972, lng = -119.7875
WHERE name = 'Fresno Memorial Auditorium' AND coalesce(address,'') = '';

UPDATE venues SET address = '5305 N. Campus Drive, Fresno, CA 93740', lat = 36.8133, lng = -119.7412
WHERE name = 'North Gym' AND coalesce(address,'') = '';
