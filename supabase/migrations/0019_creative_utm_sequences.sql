-- Persistent per-project/per-platform numbering for creative-level UTM tags.
--
-- Creative tracking links used to overload utm_content with the internal
-- creative_id. Keep the internal relationship in a real column so public UTM
-- params can use clean labels like meta, meta2, meta3. The sequence table is
-- intentionally separate from tracking links so deleting/detaching old links
-- never reuses a number.

alter table public.project_tracking_links
  add column if not exists creative_id uuid,
  add column if not exists utm_sequence integer
    check (utm_sequence is null or utm_sequence > 0);

update public.project_tracking_links
set creative_id = utm_content::uuid
where creative_id is null
  and platform is not null
  and utm_content ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

with numbered as (
  select
    id,
    row_number() over (
      partition by project_id, platform
      order by created_at, id
    )::integer as sequence
  from public.project_tracking_links
  where platform is not null
    and creative_id is not null
)
update public.project_tracking_links l
set
  utm_sequence = coalesce(l.utm_sequence, numbered.sequence),
  utm_source = case
    when coalesce(l.utm_sequence, numbered.sequence) <= 1
      then regexp_replace(l.platform, '[^a-z0-9]+', '_', 'g')
    else regexp_replace(l.platform, '[^a-z0-9]+', '_', 'g') || coalesce(l.utm_sequence, numbered.sequence)::text
  end,
  utm_content = case
    when coalesce(l.utm_sequence, numbered.sequence) <= 1
      then regexp_replace(l.platform, '[^a-z0-9]+', '_', 'g')
    else regexp_replace(l.platform, '[^a-z0-9]+', '_', 'g') || coalesce(l.utm_sequence, numbered.sequence)::text
  end
from numbered
where l.id = numbered.id;

create unique index if not exists project_tracking_links_creative_unique
  on public.project_tracking_links (project_id, platform, creative_id)
  where creative_id is not null;

create unique index if not exists project_tracking_links_utm_sequence_unique
  on public.project_tracking_links (project_id, platform, utm_sequence)
  where platform is not null and utm_sequence is not null;

create table if not exists public.project_platform_utm_sequences (
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (
    platform in (
      'website',
      'email',
      'sms',
      'internal-messaging',
      'digital-signage',
      'ott',
      'pr',
      'meta',
      'tiktok',
      'youtube',
      'google-search',
      'signage',
      'flyers'
    )
  ),
  next_sequence integer not null default 1 check (next_sequence > 0),
  updated_at timestamptz not null default now(),
  primary key (project_id, platform)
);

insert into public.project_platform_utm_sequences (project_id, platform, next_sequence)
select project_id, platform, max(utm_sequence) + 1
from public.project_tracking_links
where platform is not null
  and utm_sequence is not null
group by project_id, platform
on conflict (project_id, platform) do update
set
  next_sequence = greatest(
    public.project_platform_utm_sequences.next_sequence,
    excluded.next_sequence
  ),
  updated_at = now();

alter table public.project_platform_utm_sequences enable row level security;

create policy "auth read project_platform_utm_sequences"
  on public.project_platform_utm_sequences
  for select to authenticated using (true);

create or replace function public.claim_project_platform_utm_sequence(
  p_project_id uuid,
  p_platform text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  insert into public.project_platform_utm_sequences (
    project_id,
    platform,
    next_sequence,
    updated_at
  )
  values (p_project_id, p_platform, 2, now())
  on conflict (project_id, platform) do update
    set next_sequence = public.project_platform_utm_sequences.next_sequence + 1,
        updated_at = now()
  returning next_sequence - 1 into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_project_platform_utm_sequence(uuid, text) from public;
grant execute on function public.claim_project_platform_utm_sequence(uuid, text) to authenticated;
