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
  );

alter table public.project_tracking_links drop constraint if exists project_tracking_links_platform_check;
alter table public.project_tracking_links add constraint project_tracking_links_platform_check
  check (
    platform is null
    or platform in (
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
  );

insert into public.project_platforms (project_id, platform)
select p.id, channel.platform
from public.projects p
cross join unnest(
  array[
    'website',
    'email',
    'sms',
    'internal-messaging',
    'digital-signage',
    'ott',
    'pr',
    'flyers'
  ]::text[]
) as channel(platform)
on conflict do nothing;
