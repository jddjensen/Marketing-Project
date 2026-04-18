-- Per-project selection of which ad platforms are active.
-- Removing a platform is non-destructive: media/terms/tracking persist
-- and reappear if the platform is re-added.

create table public.project_platforms (
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('meta', 'tiktok', 'youtube', 'google-search')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, platform)
);

create index project_platforms_project_idx on public.project_platforms (project_id);

alter table public.project_platforms enable row level security;

create policy "auth read project_platforms" on public.project_platforms
  for select to authenticated using (true);
create policy "auth write project_platforms" on public.project_platforms
  for insert to authenticated with check (true);
create policy "auth delete project_platforms" on public.project_platforms
  for delete to authenticated using (true);

-- Backfill: every existing project gets all 4 platforms enabled.
insert into public.project_platforms (project_id, platform)
select p.id, plat
from public.projects p
cross join unnest(array['meta','tiktok','youtube','google-search']::text[]) as plat
on conflict do nothing;
