-- Structured campaign brief fields stored at the project level.

alter table public.projects
  add column if not exists brief_objective text,
  add column if not exists brief_audience text,
  add column if not exists brief_offer text,
  add column if not exists brief_cta text
    check (brief_cta is null or char_length(brief_cta) between 1 and 240),
  add column if not exists brief_kpi_targets text,
  add column if not exists brief_launch_start_date date,
  add column if not exists brief_launch_end_date date,
  add column if not exists brief_owner text
    check (brief_owner is null or char_length(brief_owner) between 1 and 120),
  add column if not exists brief_budget numeric(12, 2)
    check (brief_budget is null or brief_budget >= 0),
  add column if not exists brief_success_definition text;

alter table public.projects drop constraint if exists projects_brief_launch_date_order_check;
alter table public.projects add constraint projects_brief_launch_date_order_check
  check (
    brief_launch_start_date is null
    or brief_launch_end_date is null
    or brief_launch_end_date >= brief_launch_start_date
  );
