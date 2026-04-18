-- Add 'signage' as a supported platform with per-project custom formats.

-- Expand platform CHECK constraints on tables that gate by platform.
alter table public.media drop constraint if exists media_platform_check;
alter table public.media add constraint media_platform_check
  check (platform in ('meta', 'tiktok', 'youtube', 'google-search', 'signage'));

alter table public.project_platforms drop constraint if exists project_platforms_platform_check;
alter table public.project_platforms add constraint project_platforms_platform_check
  check (platform in ('meta', 'tiktok', 'youtube', 'google-search', 'signage'));

-- Per-project catalog of physical signage formats.
create table public.signage_formats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  preset_key text,
  width numeric(12,3) not null check (width > 0),
  height numeric(12,3) not null check (height > 0),
  unit text not null check (unit in ('in', 'ft', 'cm', 'm', 'px')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index signage_formats_project_idx on public.signage_formats (project_id, created_at desc);

alter table public.signage_formats enable row level security;
create policy "auth read signage_formats" on public.signage_formats
  for select to authenticated using (true);
create policy "auth write signage_formats" on public.signage_formats
  for insert to authenticated with check (true);
create policy "auth update signage_formats" on public.signage_formats
  for update to authenticated using (true) with check (true);
create policy "auth delete signage_formats" on public.signage_formats
  for delete to authenticated using (true);

-- Link signage media to a format (null for non-signage media).
alter table public.media
  add column signage_format_id uuid references public.signage_formats(id) on delete cascade;

create index media_signage_format_idx on public.media (signage_format_id);

-- Enforce: signage rows must have a format_id; non-signage rows must not.
alter table public.media
  add constraint media_signage_format_required check (
    (platform = 'signage' and signage_format_id is not null)
    or (platform <> 'signage' and signage_format_id is null)
  );

-- Backfill: existing projects get signage as an enabled platform too.
insert into public.project_platforms (project_id, platform)
select id, 'signage' from public.projects
on conflict do nothing;
