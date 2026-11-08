-- TURNING GEARS FTC SCOUTING — initial database schema
-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'TURNING GEARS',
  created_at timestamptz not null default now()
);

insert into public.teams (name)
select 'TURNING GEARS'
where not exists (select 1 from public.teams);

create table if not exists public.team_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null default 'scout' check (role in ('scout','coordinator')),
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create table if not exists public.scouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(team_id, name)
);

create table if not exists public.match_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  team_number integer not null check (team_number > 0),
  match_number integer not null check (match_number > 0),
  alliance text not null check (alliance in ('Red','Blue')),
  scout_name text not null,
  auto_rating integer check (auto_rating between 1 and 5),
  shooting_accuracy integer check (shooting_accuracy between 1 and 5),
  shooting_speed integer check (shooting_speed between 1 and 5),
  driving_speed integer check (driving_speed between 1 and 5),
  maneuverability integer check (maneuverability between 1 and 5),
  reliability integer check (reliability between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists match_records_team_number_idx on public.match_records(team_id, team_number);
create index if not exists match_records_match_number_idx on public.match_records(team_id, match_number);

create table if not exists public.pit_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  team_number integer not null check (team_number > 0),
  scout_name text not null,
  drivetrain text,
  mechanisms text,
  autonomous_description text,
  capabilities text,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid() and team_id = target_team
  );
$$;

create or replace function public.is_team_coordinator(target_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid() and team_id = target_team and role = 'coordinator'
  );
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.scouts enable row level security;
alter table public.match_records enable row level security;
alter table public.pit_records enable row level security;

drop policy if exists "members read own team" on public.teams;
create policy "members read own team" on public.teams for select using (public.is_team_member(id));

drop policy if exists "members read membership" on public.team_members;
create policy "members read membership" on public.team_members for select using (user_id = auth.uid() or public.is_team_member(team_id));

drop policy if exists "members read scouts" on public.scouts;
create policy "members read scouts" on public.scouts for select using (public.is_team_member(team_id));
drop policy if exists "coordinators add scouts" on public.scouts;
create policy "coordinators add scouts" on public.scouts for insert with check (public.is_team_coordinator(team_id));
drop policy if exists "coordinators update scouts" on public.scouts;
create policy "coordinators update scouts" on public.scouts for update using (public.is_team_coordinator(team_id)) with check (public.is_team_coordinator(team_id));

drop policy if exists "members read match records" on public.match_records;
create policy "members read match records" on public.match_records for select using (public.is_team_member(team_id));
drop policy if exists "members add match records" on public.match_records;
create policy "members add match records" on public.match_records for insert with check (
  public.is_team_member(team_id) and submitted_by = auth.uid()
);

drop policy if exists "members read pit records" on public.pit_records;
create policy "members read pit records" on public.pit_records for select using (public.is_team_member(team_id));
drop policy if exists "members add pit records" on public.pit_records;
create policy "members add pit records" on public.pit_records for insert with check (
  public.is_team_member(team_id) and submitted_by = auth.uid()
);

grant usage on schema public to authenticated;
grant select on public.teams, public.team_members, public.scouts, public.match_records, public.pit_records to authenticated;
grant insert on public.scouts, public.match_records, public.pit_records to authenticated;
grant update on public.scouts to authenticated;

-- After deploying the join-team function and joining once with your coordinator code,
-- add your first scout name from the app's Roster tab.
