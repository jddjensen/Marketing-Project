-- First-party click tracking for project tracking links and a narrow public
-- resolver function for redirect routes.

create table public.project_tracking_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.project_tracking_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  user_agent text,
  referrer text
);

create index project_tracking_link_clicks_link_idx
  on public.project_tracking_link_clicks (link_id, clicked_at desc);

alter table public.project_tracking_link_clicks enable row level security;

create policy "auth read link_clicks" on public.project_tracking_link_clicks
  for select to authenticated using (true);
create policy "anon insert link_clicks" on public.project_tracking_link_clicks
  for insert to anon with check (true);
create policy "auth insert link_clicks" on public.project_tracking_link_clicks
  for insert to authenticated with check (true);

create or replace function public.resolve_public_tracking_link(link_uuid uuid)
returns table (
  id uuid,
  url text,
  platform text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  qr_enabled boolean,
  project_name text
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.url,
    l.platform,
    l.utm_source,
    l.utm_medium,
    l.utm_campaign,
    l.utm_term,
    l.utm_content,
    l.qr_enabled,
    p.name as project_name
  from public.project_tracking_links l
  join public.projects p on p.id = l.project_id
  where l.id = link_uuid
  limit 1
$$;

revoke all on function public.resolve_public_tracking_link(uuid) from public;
grant execute on function public.resolve_public_tracking_link(uuid) to anon, authenticated;

drop policy if exists "anon read link for redirect" on public.project_tracking_links;
