-- Perceived-performance + dedup support for media.
--
-- thumb_storage_path: a small WebP rendition (≤320px long edge) generated at
--   upload time for images, so grids load ~KB tiles instead of multi-MB
--   originals. Null for videos (their poster_storage_path is the tile) and for
--   media uploaded before this migration (backfill script fills these).
-- thumbhash: a ~25-byte base64 ThumbHash used to render an instant blurred
--   placeholder client-side before the real image paints. Null = no placeholder
--   (falls back to the neutral tile background).
-- content_hash: sha256 (hex) of the original uploaded bytes, used for a soft
--   "possible duplicate" hint at upload time. Images only; null for video/text.
alter table public.media
  add column thumb_storage_path text,
  add column thumbhash text check (thumbhash is null or char_length(thumbhash) <= 80),
  add column content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');

-- Cheap lookup for the soft duplicate-detection check on upload, which filters
-- by project + hash among current rows.
create index if not exists media_project_content_hash_idx
  on public.media (project_id, content_hash)
  where content_hash is not null and is_current;
