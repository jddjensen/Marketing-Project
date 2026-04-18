-- Per-project UTM / tracking link builder.
-- Each row is a destination URL scoped to a project. A row may target all
-- platforms (platform is null) or be pinned to a single platform.

create table public.project_tracking_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null check (char_length(url) between 1 and 2048),
  label text check (label is null or char_length(label) between 1 and 120),
  platform text check (
    platform is null
    or platform in ('meta', 'tiktok', 'youtube', 'google-search', 'signage')
  ),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_tracking_links_project_idx
  on public.project_tracking_links (project_id, created_at desc);
create index project_tracking_links_platform_idx
  on public.project_tracking_links (project_id, platform);

create trigger project_tracking_links_touch_updated_at
  before update on public.project_tracking_links
  for each row execute function public.touch_updated_at();

alter table public.project_tracking_links enable row level security;

create policy "auth read project_tracking_links" on public.project_tracking_links
  for select to authenticated using (true);
create policy "auth write project_tracking_links" on public.project_tracking_links
  for insert to authenticated with check (true);
create policy "auth update project_tracking_links" on public.project_tracking_links
  for update to authenticated using (true) with check (true);
create policy "auth delete project_tracking_links" on public.project_tracking_links
  for delete to authenticated using (true);

-- Per-project preference for where the tracking-links UI is shown.
alter table public.projects
  add column tracking_links_location text not null default 'both'
    check (tracking_links_location in ('project_tab', 'platform_panel', 'both'));
