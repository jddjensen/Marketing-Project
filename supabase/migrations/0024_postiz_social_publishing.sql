-- Optional social publishing bridge.
--
-- Postiz owns connected accounts, OAuth tokens, provider rules, retries, and
-- final publishing. This app stores only the local receipt that a creative was
-- submitted to Postiz, keeping the integration thin and low-maintenance.

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creative_id uuid not null,
  media_version_id uuid references public.media(id) on delete set null,
  tracking_link_id uuid references public.project_tracking_links(id) on delete set null,
  platform text not null,
  provider text not null default 'postiz' check (provider = 'postiz'),
  postiz_post_id text,
  postiz_integration_id text not null,
  postiz_integration_identifier text not null,
  postiz_integration_name text not null,
  state text not null default 'submitted'
    check (state in ('submitted', 'scheduled', 'published', 'failed', 'cancelled', 'deleted', 'unknown')),
  publish_at timestamptz,
  content text not null default '',
  settings jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_posts_project_idx
  on public.social_posts (project_id, created_at desc);
create index social_posts_creative_idx
  on public.social_posts (creative_id, created_at desc);
create index social_posts_postiz_post_idx
  on public.social_posts (postiz_post_id)
  where postiz_post_id is not null;

create trigger social_posts_touch_updated_at
  before update on public.social_posts
  for each row execute function public.touch_updated_at();

alter table public.social_posts enable row level security;

create policy "auth read social_posts" on public.social_posts
  for select to authenticated using (true);
create policy "auth write social_posts" on public.social_posts
  for insert to authenticated with check (true);
create policy "auth update social_posts" on public.social_posts
  for update to authenticated using (true) with check (true);
create policy "auth delete social_posts" on public.social_posts
  for delete to authenticated using (true);
