-- Calendar metadata on campaign brief: lets the master marketing calendar
-- group projects by event and exhibit alongside the existing launch dates.

alter table public.projects
  add column if not exists brief_event text
    check (brief_event is null or char_length(brief_event) between 1 and 120),
  add column if not exists brief_exhibit text
    check (brief_exhibit is null or char_length(brief_exhibit) between 1 and 120);
