-- Store the intrinsic pixel dimensions of uploaded media so the UI can show
-- whether an asset actually fits its slot's required ratio/size. Nullable:
-- text creatives have no dimensions, and media uploaded before this migration
-- is unknown.

alter table public.media
  add column width integer check (width is null or (width > 0 and width <= 100000)),
  add column height integer check (height is null or (height > 0 and height <= 100000));
