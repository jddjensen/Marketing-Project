-- Introduce projects as parent container for all platform collateral.
-- Shared workspace: any authenticated user can see and edit any project.

-- Clear dev data so NOT NULL FK additions succeed.
delete from public.tracking;
delete from public.search_terms;
delete from public.media;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index projects_archived_idx on public.projects (archived_at);
create index projects_updated_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

create policy "auth read projects" on public.projects for select to authenticated using (true);
create policy "auth write projects" on public.projects for insert to authenticated with check (true);
create policy "auth update projects" on public.projects for update to authenticated using (true) with check (true);
create policy "auth delete projects" on public.projects for delete to authenticated using (true);

-- Trigger to maintain updated_at.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- Link existing tables to a project.
alter table public.media
  add column project_id uuid not null references public.projects(id) on delete cascade;

alter table public.search_terms
  add column project_id uuid not null references public.projects(id) on delete cascade;

alter table public.tracking
  add column project_id uuid not null references public.projects(id) on delete cascade;

-- Replace the unique constraint on search_terms so dupes are per-project.
alter table public.search_terms drop constraint if exists search_terms_platform_value_key;
create unique index search_terms_project_platform_value_idx
  on public.search_terms (project_id, platform, value);

create index media_project_idx on public.media (project_id, platform, ratio, uploaded_at desc);
create index search_terms_project_idx on public.search_terms (project_id, platform, added_at desc);
create index tracking_project_idx on public.tracking (project_id);
