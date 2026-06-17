-- Optional Plausible Analytics reporting.
--
-- Plausible tracks standard UTM fields on the destination site. We keep the
-- site ID per project so the dashboard can query the Plausible Stats API with
-- this app's generated UTM values.

alter table public.projects
  add column if not exists plausible_site_id text
    check (
      plausible_site_id is null
      or char_length(plausible_site_id) between 1 and 255
    );
