-- Hardens the versioning model against concurrent-write races discovered in
-- the bug audit:
--
-- 1. Partial unique index — there can only ever be ONE is_current=true row
--    per creative_id. Two concurrent replace requests that try to insert a
--    new "current" version race-free now: one wins, the second fails with
--    a unique-violation that the API catches and returns 409 for.
--
-- 2. restore_creative_version RPC — atomically flips is_current within a
--    single SQL statement instead of the previous two-step (archive all,
--    then restore one) update that could interleave under concurrency.

create unique index if not exists media_one_current_per_creative
  on public.media (creative_id)
  where is_current = true;

create or replace function public.restore_creative_version(
  p_project_id uuid,
  p_creative_id uuid,
  p_version_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  found boolean;
begin
  -- Confirm the target version belongs to the given creative + project.
  select exists (
    select 1 from public.media
    where id = p_version_id
      and creative_id = p_creative_id
      and project_id = p_project_id
  ) into found;

  if not found then
    return false;
  end if;

  -- Single statement: every row of this creative gets is_current=true if
  -- it's the target row, false otherwise. Atomic; the partial unique index
  -- enforces invariants.
  update public.media
    set is_current = (id = p_version_id)
    where creative_id = p_creative_id
      and project_id = p_project_id;

  return true;
end;
$$;

revoke all on function public.restore_creative_version(uuid, uuid, uuid) from public;
grant execute on function public.restore_creative_version(uuid, uuid, uuid) to authenticated;
