create table public.signage_blueprints (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 120),
  width numeric(12,3) not null check (width > 0),
  height numeric(12,3) not null check (height > 0),
  unit text not null check (unit in ('in', 'ft', 'cm', 'm', 'px')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index signage_blueprints_created_by_idx
  on public.signage_blueprints (created_by, created_at desc);

alter table public.signage_blueprints enable row level security;

create policy "auth read own signage_blueprints" on public.signage_blueprints
  for select to authenticated
  using (auth.uid() = created_by);

create policy "auth insert own signage_blueprints" on public.signage_blueprints
  for insert to authenticated
  with check (auth.uid() = created_by);

create policy "auth update own signage_blueprints" on public.signage_blueprints
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "auth delete own signage_blueprints" on public.signage_blueprints
  for delete to authenticated
  using (auth.uid() = created_by);
