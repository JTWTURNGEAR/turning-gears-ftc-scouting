-- TURNING GEARS: allow any authenticated team member (the app uses anonymous
-- Supabase sessions after the shared team code) to add their own scout name.
-- Run this once in Supabase SQL Editor. It does not delete existing data.

-- Prevent duplicate names for the same team even when capitalization differs.
create unique index if not exists scouts_team_name_ci_unique
  on public.scouts (team_id, lower(trim(name)));

-- Replace coordinator-only insert permission with team-member self-registration.
drop policy if exists "coordinators add scouts" on public.scouts;
drop policy if exists "team members add scout names" on public.scouts;
create policy "team members add scout names"
  on public.scouts
  for insert
  to authenticated
  with check (
    public.is_team_member(team_id)
    and length(trim(name)) between 1 and 40
    and name = trim(name)
  );

-- Keep roster deactivation restricted to coordinators.
drop policy if exists "coordinators update scouts" on public.scouts;
create policy "coordinators update scouts"
  on public.scouts
  for update
  to authenticated
  using (public.is_team_coordinator(team_id))
  with check (public.is_team_coordinator(team_id));

grant insert on public.scouts to authenticated;
