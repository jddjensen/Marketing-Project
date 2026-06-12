-- Account-level custom communication channels.
-- A custom channel is defined once (name + kind + dimension formats) and is
-- then selectable on any project, addressed by the synthetic platform key
-- 'custom-<channel uuid>' in project_platforms and media.

create table public.custom_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 240),
  kind text not null check (
    kind in ('digital-ad', 'digital-static', 'print', 'video', 'audio', 'other')
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.custom_channel_formats (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.custom_channels(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  width numeric(12,3) not null check (width > 0 and width <= 1000000),
  height numeric(12,3) not null check (height > 0 and height <= 1000000),
  unit text not null check (unit in ('px', 'in', 'ft', 'cm', 'm')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index custom_channel_formats_channel_idx
  on public.custom_channel_formats (channel_id, position);

-- Shared workspace model, same as every other table: any authenticated user
-- can read and write.
alter table public.custom_channels enable row level security;
alter table public.custom_channel_formats enable row level security;

create policy "auth read custom_channels" on public.custom_channels
  for select to authenticated using (true);
create policy "auth write custom_channels" on public.custom_channels
  for insert to authenticated with check (true);
create policy "auth update custom_channels" on public.custom_channels
  for update to authenticated using (true) with check (true);
create policy "auth delete custom_channels" on public.custom_channels
  for delete to authenticated using (true);

create policy "auth read custom_channel_formats" on public.custom_channel_formats
  for select to authenticated using (true);
create policy "auth write custom_channel_formats" on public.custom_channel_formats
  for insert to authenticated with check (true);
create policy "auth update custom_channel_formats" on public.custom_channel_formats
  for update to authenticated using (true) with check (true);
create policy "auth delete custom_channel_formats" on public.custom_channel_formats
  for delete to authenticated using (true);

-- Allow the synthetic 'custom-<uuid>' platform key everywhere a project can
-- enable a channel and media can be filed under one. Tracking links keep the
-- built-in whitelist (custom channels launch without tracking).

alter table public.media drop constraint if exists media_platform_check;
alter table public.media add constraint media_platform_check
  check (
    platform in (
      'meta',
      'tiktok',
      'youtube',
      'google-search',
      'website',
      'email',
      'sms',
      'internal-messaging',
      'digital-signage',
      'ott',
      'pr',
      'signage',
      'flyers'
    )
    or platform ~ '^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

alter table public.project_platforms drop constraint if exists project_platforms_platform_check;
alter table public.project_platforms add constraint project_platforms_platform_check
  check (
    platform in (
      'meta',
      'tiktok',
      'youtube',
      'google-search',
      'website',
      'email',
      'sms',
      'internal-messaging',
      'digital-signage',
      'ott',
      'pr',
      'signage',
      'flyers'
    )
    or platform ~ '^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
