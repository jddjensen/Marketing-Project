-- Per-project Google Analytics 4 property used for link dashboards.

alter table public.projects
  add column if not exists ga4_property_id text
    check (
      ga4_property_id is null
      or ga4_property_id ~ '^[0-9]{5,20}$'
    );
