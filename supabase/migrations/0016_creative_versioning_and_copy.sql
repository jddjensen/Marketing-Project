-- Versioning + per-platform copy + text-only creatives.
--
-- Versioning model:
--   - Every media row belongs to a `creative_id` (a stable group identifier).
--   - On first upload, `creative_id` is fresh; `version_num = 1`; `is_current = true`.
--   - On replace, a new row reuses the same `creative_id`, increments `version_num`,
--     and the previous current version flips `is_current = false` (archived).
--     The user can opt to delete the old version's storage object instead of
--     archiving — that's handled at the API layer, not the DB.
--   - Reader queries filter `is_current = true` to surface only the live version.
--
-- Copy:
--   - `copy` is a JSONB blob whose schema is platform-specific and enforced at
--     the API layer (see src/lib/platformCopy.ts). Each version owns its own
--     copy so visual/text variants can be tested independently.
--
-- Text-only creatives:
--   - For Email/SMS/PR-style channels, copy is the creative. We allow rows
--     where `kind = 'text'` and the file-related columns are null. A check
--     constraint makes sure that's the only case where they can be null.

alter table public.media
  add column creative_id uuid not null default gen_random_uuid(),
  add column version_num integer not null default 1,
  add column is_current boolean not null default true,
  add column copy jsonb;

-- Allow text creatives. Drop the old kind constraint and add a wider one.
alter table public.media drop constraint if exists media_kind_check;
alter table public.media add constraint media_kind_check
  check (kind in ('image', 'video', 'text'));

-- File columns become nullable to support text-only creatives.
alter table public.media alter column storage_path drop not null;
alter table public.media alter column original_name drop not null;
alter table public.media alter column mime_type drop not null;
alter table public.media alter column size_bytes drop not null;

-- Enforce: file kinds must have storage; text kind must not.
alter table public.media add constraint media_kind_storage_check check (
  (kind in ('image', 'video') and storage_path is not null and mime_type is not null)
  or (kind = 'text' and storage_path is null and mime_type is null)
);

-- Drop the old per-row uniqueness on storage_path so the constraint allows
-- nulls for text rows; re-add it as a partial unique index over non-nulls.
alter table public.media drop constraint if exists media_storage_path_key;
create unique index if not exists media_storage_path_unique
  on public.media (storage_path) where storage_path is not null;

-- Hot path: list current versions for a project + platform.
create index if not exists media_current_idx
  on public.media (project_id, platform)
  where is_current = true;

-- Look up version history for a creative.
create index if not exists media_creative_idx
  on public.media (creative_id, version_num desc);
