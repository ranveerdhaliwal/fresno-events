-- Hero images use upstream source URLs; stop pointing cdn_url at self-hosted /images/* paths.
update public.images
set cdn_url = source_url
where source_url is not null
  and source_url ~ '^https?://'
  and cdn_url like '/images/%';
