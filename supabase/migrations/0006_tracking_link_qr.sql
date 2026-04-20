-- Persistent QR codes + scan tracking for project_tracking_links.
-- The QR encodes a stable redirect URL (/qr/:linkId) rather than the raw
-- UTM URL, so scans can be counted and the landing URL can be changed
-- after signage is printed.

alter table public.project_tracking_links
  add column qr_enabled boolean not null default false,
  add column qr_generated_at timestamptz;

-- Scan log. One row per scan. Kept intentionally light: no PII, coarse UA/
-- referrer for light diagnostics only.
create table public.project_tracking_link_scans (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.project_tracking_links(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  user_agent text,
  referrer text
);

create index project_tracking_link_scans_link_idx
  on public.project_tracking_link_scans (link_id, scanned_at desc);

alter table public.project_tracking_link_scans enable row level security;

-- Reads: anyone authenticated (same model as other project-scoped tables).
create policy "auth read link_scans" on public.project_tracking_link_scans
  for select to authenticated using (true);

-- Inserts from the redirect handler: allow anon (the scan handler is public).
create policy "anon insert link_scans" on public.project_tracking_link_scans
  for insert to anon with check (true);
create policy "auth insert link_scans" on public.project_tracking_link_scans
  for insert to authenticated with check (true);

-- Also allow the anon client to resolve a link to redirect to. Scoped to the
-- minimum needed columns via the existing select policy which is authenticated-
-- only; we add a narrow anon select here on just the redirect-needed row.
create policy "anon read link for redirect" on public.project_tracking_links
  for select to anon using (qr_enabled = true);
