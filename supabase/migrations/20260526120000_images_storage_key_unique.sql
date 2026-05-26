-- Required for PostgREST upsert on images.storage_key (approve-time image mirroring).
create unique index if not exists images_storage_key_unique on public.images (storage_key);
