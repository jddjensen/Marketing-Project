-- Marketing Platform initial schema.
-- Shared workspace model: any authenticated user can read and write all rows.

set check_function_bodies = off;

-- ===========================================================================
-- Tables
-- ===========================================================================

create table public.media (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta', 'tiktok', 'youtube', 'google-search')),
  ratio text not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  kind text not null check (kind in ('image', 'video')),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index media_platform_ratio_idx on public.media (platform, ratio, uploaded_at desc);

create table public.search_terms (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('google-search')),
  value text not null,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (platform, value)
);

create index search_terms_platform_idx on public.search_terms (platform, added_at desc);

create table public.tracking (
  id text primary key,
  media_id uuid not null references public.media(id) on delete cascade unique,
  destination_url text not null,
  clicks bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tracking_media_idx on public.tracking (media_id);

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.media enable row level security;
alter table public.search_terms enable row level security;
alter table public.tracking enable row level security;

-- Any authenticated user can read/write everything (shared workspace).
create policy "auth read media" on public.media for select to authenticated using (true);
create policy "auth write media" on public.media for insert to authenticated with check (true);
create policy "auth update media" on public.media for update to authenticated using (true) with check (true);
create policy "auth delete media" on public.media for delete to authenticated using (true);

create policy "auth read terms" on public.search_terms for select to authenticated using (true);
create policy "auth write terms" on public.search_terms for insert to authenticated with check (true);
create policy "auth delete terms" on public.search_terms for delete to authenticated using (true);

create policy "auth read tracking" on public.tracking for select to authenticated using (true);
create policy "auth write tracking" on public.tracking for insert to authenticated with check (true);
create policy "auth update tracking" on public.tracking for update to authenticated using (true) with check (true);
create policy "auth delete tracking" on public.tracking for delete to authenticated using (true);

-- Anonymous visitors must be able to look up a tracking row to redirect.
-- Expose only id + destination_url through the RPC below (not direct select).
-- No direct anon policy on tracking.

-- ===========================================================================
-- Public click-increment RPC (runs with owner privileges via SECURITY DEFINER)
-- ===========================================================================

create or replace function public.increment_click(tracking_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  dest text;
begin
  update public.tracking
    set clicks = clicks + 1
    where id = tracking_id
    returning destination_url into dest;
  return dest;
end;
$$;

revoke all on function public.increment_click(text) from public;
grant execute on function public.increment_click(text) to anon, authenticated;

-- ===========================================================================
-- Storage bucket + policies
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('creatives', 'creatives', true, 524288000)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Public read so the browser can render media directly from storage URLs.
create policy "public read creatives" on storage.objects for select
  using (bucket_id = 'creatives');

create policy "auth upload creatives" on storage.objects for insert to authenticated
  with check (bucket_id = 'creatives');

create policy "auth update creatives" on storage.objects for update to authenticated
  using (bucket_id = 'creatives');

create policy "auth delete creatives" on storage.objects for delete to authenticated
  using (bucket_id = 'creatives');
