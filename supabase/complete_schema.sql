-- =============================================================================
-- Complete KingsArena Schema
-- Run this in the Supabase Dashboard SQL Editor to apply the full schema
-- This file combines 01_tables.sql, 02_functions.sql, 03_views.sql, and 04_rls_grants.sql
-- =============================================================================

-- =============================================================================
-- PART 1: TABLES (from 01_tables.sql)
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Teams table
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique
              check (char_length(btrim(name)) between 3 and 40),
  description text,
  game        text not null
              check (game in ('dls', 'efootball', 'fcmobile', 'cod')),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.teams is
  'Player teams. The owner is auto-added to team_members as role ''owner'' by a trigger.';

-- Team members table
create table if not exists public.team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member'
            check (role in ('owner', 'captain', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

comment on table public.team_members is
  'Team roster. Non-owner rows are inserted by the client; the owner row comes from a trigger.';

-- Tournaments table
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  game text not null,
  format text not null default 'league'
    check (format in ('league', 'knockout', 'group_knockout')),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'registration', 'ongoing', 'completed', 'cancelled')),
  max_participants integer check (max_participants is null or max_participants > 1),
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add tournament columns
alter table public.tournaments add column if not exists image_url text;
alter table public.tournaments add column if not exists rules text;
alter table public.tournaments add column if not exists entry_fee numeric(10, 2);
alter table public.tournaments add column if not exists prize_pool numeric(12, 2);
alter table public.tournaments add column if not exists registration_deadline timestamptz;

-- Set defaults for money columns
update public.tournaments set entry_fee = 0 where entry_fee is null;
update public.tournaments set prize_pool = 0 where prize_pool is null;
alter table public.tournaments alter column entry_fee set not null;
alter table public.tournaments alter column prize_pool set not null;

-- Add constraints
alter table public.tournaments drop constraint if exists tournaments_entry_fee_check;
alter table public.tournaments add constraint tournaments_entry_fee_check
  check (entry_fee >= 0);

alter table public.tournaments drop constraint if exists tournaments_prize_pool_check;
alter table public.tournaments add constraint tournaments_prize_pool_check
  check (prize_pool >= 0);

-- Normalize game values
do $$
declare
  v_offending integer;
begin
  select count(*)
    into v_offending
  from public.tournaments
  where game not in ('dls', 'efootball', 'fcmobile', 'cod');
  if v_offending > 0 then
    update public.tournaments
       set game = 'dls'
     where game not in ('dls', 'efootball', 'fcmobile', 'cod');
    raise notice 'Coerced % tournament(s) with unknown game value to ''dls''', v_offending;
  end if;
end
$$;

alter table public.tournaments drop constraint if exists tournaments_game_check;
alter table public.tournaments add constraint tournaments_game_check
  check (game in ('dls', 'efootball', 'fcmobile', 'cod'));

-- Normalize tournament names
do $$
declare
  v_offending integer;
begin
  select count(*)
    into v_offending
  from public.tournaments
  where char_length(btrim(name)) not between 3 and 100;
  if v_offending > 0 then
    update public.tournaments
       set name = btrim(name) || 'Tournament'
     where char_length(btrim(name)) < 3;
    raise notice 'Padded % tournament name(s) that were shorter than 3 chars', v_offending;
  end if;
end
$$;

alter table public.tournaments drop constraint if exists tournaments_name_check;
alter table public.tournaments add constraint tournaments_name_check
  check (char_length(btrim(name)) between 3 and 100);

alter table public.tournaments drop constraint if exists tournaments_image_url_check;
alter table public.tournaments add constraint tournaments_image_url_check
  check (image_url is null or image_url ~ '^https?://');

-- Tournament participants table
create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

-- Add participant columns
alter table public.tournament_participants
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.tournament_participants
  drop constraint if exists tournament_participants_participant_check;
alter table public.tournament_participants add constraint tournament_participants_participant_check
  check ((user_id is not null and team_id is null)
      or (user_id is null  and team_id is not null));

alter table public.tournament_participants
  add column if not exists status text not null default 'registered';

alter table public.tournament_participants
  drop constraint if exists tournament_participants_status_check;
alter table public.tournament_participants add constraint tournament_participants_status_check
  check (status in ('registered', 'withdrawn', 'eliminated'));

alter table public.tournament_participants add column if not exists seed integer;
alter table public.tournament_participants alter column user_id drop not null;

-- Fixtures table
create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  home_player_id uuid not null references public.profiles(id) on delete cascade,
  away_player_id uuid not null references public.profiles(id) on delete cascade,
  round integer,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  check (home_player_id <> away_player_id)
);

-- Clear fixtures for migration
do $$
begin
  if exists (select 1 from public.fixtures) then
    delete from public.fixtures;
    raise notice 'Cleared existing fixtures rows for participant-based migration';
  end if;
end
$$;

-- Drop policies before column changes
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='fixtures'
  loop
    execute format('drop policy if exists %I on public.fixtures', p.policyname);
  end loop;
end
$$;

alter table public.fixtures drop column if exists home_player_id;
alter table public.fixtures drop column if exists away_player_id;

alter table public.fixtures
  add column if not exists home_participant_id uuid
  references public.tournament_participants(id) on delete cascade;
alter table public.fixtures
  add column if not exists away_participant_id uuid
  references public.tournament_participants(id) on delete cascade;

alter table public.fixtures add column if not exists match_number integer;
alter table public.fixtures add column if not exists updated_at timestamptz not null default now();

alter table public.fixtures drop constraint if exists fixtures_home_away_check;
alter table public.fixtures add constraint fixtures_home_away_check
  check (home_participant_id is not null
     and away_participant_id is not null
     and home_participant_id <> away_participant_id);

alter table public.fixtures drop constraint if exists fixtures_status_check;
alter table public.fixtures add constraint fixtures_status_check
  check (status in ('scheduled', 'completed', 'cancelled'));

-- Fixture results table
create table if not exists public.fixture_results (
  fixture_id uuid primary key references public.fixtures(id) on delete cascade,
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

alter table public.fixture_results alter column home_score  drop not null;
alter table public.fixture_results alter column away_score  drop not null;
alter table public.fixture_results alter column submitted_by drop not null;

alter table public.fixture_results add column if not exists status text not null default 'pending';

alter table public.fixture_results drop constraint if exists fixture_results_status_check;
alter table public.fixture_results add constraint fixture_results_status_check
  check (status in ('pending', 'submitted'));

alter table public.fixture_results add column if not exists notes text;
alter table public.fixture_results add column if not exists updated_at timestamptz not null default now();

-- Indexes
create index if not exists tournament_participants_tournament_id_idx
  on public.tournament_participants (tournament_id);

create index if not exists tournament_participants_tournament_id_status_idx
  on public.tournament_participants (tournament_id, status);

create index if not exists tournament_participants_team_id_idx
  on public.tournament_participants (team_id);

create index if not exists team_members_user_id_idx
  on public.team_members (user_id);

create index if not exists teams_owner_id_idx
  on public.teams (owner_id);

create index if not exists fixtures_tournament_id_idx
  on public.fixtures (tournament_id);

create index if not exists fixtures_home_participant_id_idx
  on public.fixtures (home_participant_id);

create index if not exists fixtures_away_participant_id_idx
  on public.fixtures (away_participant_id);

create index if not exists fixture_results_submitted_by_idx
  on public.fixture_results (submitted_by);

create unique index if not exists tournament_participants_tournament_team_key
  on public.tournament_participants (tournament_id, team_id)
  where team_id is not null;

-- =============================================================================
-- PART 2: FUNCTIONS (from 02_functions.sql)
-- =============================================================================

-- Identity helpers
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
$$;

comment on function public.current_profile_id() is
  'profiles.id of the current auth user, or NULL when signed out. Use this instead of comparing auth.uid() to a profiles.id column.';

create or replace function public.is_tournament_organizer(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_tournament_id
      and t.organizer_id = public.current_profile_id()
  )
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = p_team_id
      and t.owner_id = public.current_profile_id()
  )
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = public.current_profile_id()
  )
$$;

create or replace function public.can_join_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_tournament_id
      and t.status in ('upcoming', 'registration')
      and (t.registration_deadline is null or t.registration_deadline >= now())
      and (
        t.max_participants is null
        or (
          select count(*)
          from public.tournament_participants tp
          where tp.tournament_id = t.id
        ) < t.max_participants
      )
  )
$$;

comment on function public.can_join_tournament(uuid) is
  'Open, deadline-respecting and capacity-checking join gate for a tournament.';

create or replace function public.safe_bool(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_value is null then false
    when lower(p_value) in ('true', 't', 'yes', 'y', '1', 'on')  then true
    when lower(p_value) in ('false', 'f', 'no', 'n', '0', 'off') then false
    else false
  end
$$;

-- Signup trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_username text;
  final_username text;
  display_name   text;
  suffix         integer := 1;
begin
  begin
    base_username := left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      20
    );

    if base_username is null or btrim(base_username) = '' then
      base_username := 'player' || left(replace(new.id::text, '-', ''), 8);
    end if;

    final_username := base_username;
    while exists (select 1 from public.profiles where username = final_username) loop
      suffix := suffix + 1;
      final_username := left(
        left(base_username, greatest(1, 20 - length(suffix::text) - 1)) || suffix::text,
        20
      );
      exit when suffix > 100000;
    end loop;

    display_name := left(
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), final_username),
      30
    );

    insert into public.profiles (
      user_id,
      username,
      display_name,
      profile_picture,
      bio,
      game_dls,
      game_efootball,
      game_fcmobile,
      game_cod
    )
    values (
      new.id,
      final_username,
      display_name,
      nullif(new.raw_user_meta_data ->> 'profile_picture', ''),
      nullif(new.raw_user_meta_data ->> 'bio', ''),
      public.safe_bool(new.raw_user_meta_data ->> 'game_dls'),
      public.safe_bool(new.raw_user_meta_data ->> 'game_efootball'),
      public.safe_bool(new.raw_user_meta_data ->> 'game_fcmobile'),
      public.safe_bool(new.raw_user_meta_data ->> 'game_cod')
    );
  exception
    when others then
      raise warning 'handle_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- Fixture result sync
create or replace function public.sync_fixture_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.home_score is not null and new.away_score is not null then
    update public.fixtures
    set status = 'completed',
        updated_at = timezone('utc', now())
    where id = new.fixture_id
      and status is distinct from 'completed';
  end if;
  return new;
end;
$$;

comment on function public.sync_fixture_status() is
  'AFTER INSERT OR UPDATE ON fixture_results: marks the parent fixture completed once both scores are present.';

-- Fixture generation
create or replace function public.generate_fixtures(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id        uuid;
  v_format    text;
  v_status    text;
  v_organizer uuid;
  v_ids       uuid[] := '{}';
  v_count     integer;
  v_inserted  integer := 0;
  v_match_no  integer := 1;
  i           integer;
  j           integer;
begin
  select t.id, t.format, t.status, t.organizer_id
    into v_id, v_format, v_status, v_organizer
  from public.tournaments t
  where t.id = p_tournament_id
  for update;

  if v_id is null then
    raise exception 'Tournament not found';
  end if;

  if not public.is_tournament_organizer(p_tournament_id) then
    raise exception 'Not authorized';
  end if;

  if v_status not in ('upcoming', 'registration') then
    raise exception 'Cannot generate fixtures while tournament is %', v_status;
  end if;

  if exists (select 1 from public.fixtures f where f.tournament_id = p_tournament_id) then
    raise exception 'Fixtures already generated';
  end if;

  select coalesce(array_agg(tp.id order by tp.seed nulls last, tp.joined_at), '{}'::uuid[])
    into v_ids
  from public.tournament_participants tp
  where tp.tournament_id = p_tournament_id
    and tp.status = 'registered';

  v_count := coalesce(array_length(v_ids, 1), 0);

  if v_count < 2 then
    raise exception 'Need at least 2 registered participants';
  end if;

  if v_format = 'league' then
    for i in 1 .. v_count loop
      for j in (i + 1) .. v_count loop
        insert into public.fixtures (
          tournament_id, home_participant_id, away_participant_id,
          round, match_number, status
        )
        values (p_tournament_id, v_ids[i], v_ids[j], 1, v_match_no, 'scheduled');
        v_match_no := v_match_no + 1;
        v_inserted := v_inserted + 1;
      end loop;
    end loop;
  else
    i := 1;
    while i + 1 <= v_count loop
      insert into public.fixtures (
        tournament_id, home_participant_id, away_participant_id,
        round, match_number, status
      )
      values (p_tournament_id, v_ids[i], v_ids[i + 1], 1, v_match_no, 'scheduled');
      v_match_no := v_match_no + 1;
      v_inserted := v_inserted + 1;
      i := i + 2;
    end loop;
  end if;

  update public.tournaments
  set status = 'ongoing',
      updated_at = timezone('utc', now())
  where id = p_tournament_id;

  return v_inserted;
end;
$$;

comment on function public.generate_fixtures(uuid) is
  'Organizer-only bracket builder. league = full round-robin (round 1); knockout/group_knockout = single elimination pairing. Sets the tournament to ''ongoing'' and returns the fixture count.';

create or replace function public.generate_next_round(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining uuid[] := '{}';
  v_count    integer;
  v_inserted integer := 0;
  v_round    integer;
  v_match_no integer;
  i          integer;
begin
  if not exists (select 1 from public.tournaments t where t.id = p_tournament_id) then
    raise exception 'Tournament not found';
  end if;

  if not public.is_tournament_organizer(p_tournament_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(array_agg(tp.id order by tp.seed nulls last, tp.joined_at), '{}'::uuid[])
    into v_remaining
  from public.tournament_participants tp
  where tp.tournament_id = p_tournament_id
    and tp.status = 'registered'
    and not exists (
      select 1
      from public.fixtures f
      join public.fixture_results fr on fr.fixture_id = f.id
      where f.tournament_id = p_tournament_id
        and fr.home_score is not null
        and fr.away_score is not null
        and (
          (f.home_participant_id = tp.id and fr.home_score  < fr.away_score)
       or (f.away_participant_id = tp.id and fr.away_score  < fr.home_score)
        )
    );

  v_count := coalesce(array_length(v_remaining, 1), 0);

  if v_count < 2 then
    raise exception 'No remaining participants';
  end if;

  select coalesce(max(f.round), 0) + 1
    into v_round
  from public.fixtures f
  where f.tournament_id = p_tournament_id;

  select coalesce(max(f.match_number), 0) + 1
    into v_match_no
  from public.fixtures f
  where f.tournament_id = p_tournament_id;

  i := 1;
  while i + 1 <= v_count loop
    insert into public.fixtures (
      tournament_id, home_participant_id, away_participant_id,
      round, match_number, status
    )
    values (p_tournament_id, v_remaining[i], v_remaining[i + 1], v_round, v_match_no, 'scheduled');
    v_match_no := v_match_no + 1;
    v_inserted := v_inserted + 1;
    i := i + 2;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.generate_next_round(uuid) is
  'Organizer-only. Pairs still-alive registered participants into the next round and returns the fixture count.';

-- Triggers
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists update_tournaments_updated_at on public.tournaments;
create trigger update_tournaments_updated_at
  before update on public.tournaments
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_teams_updated_at on public.teams;
create trigger update_teams_updated_at
  before update on public.teams
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_fixtures_updated_at on public.fixtures;
create trigger update_fixtures_updated_at
  before update on public.fixtures
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_fixture_results_updated_at on public.fixture_results;
create trigger update_fixture_results_updated_at
  before update on public.fixture_results
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists on_fixture_result_sync on public.fixture_results;
create trigger on_fixture_result_sync
  after insert or update on public.fixture_results
  for each row
  execute function public.sync_fixture_status();

create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_team() is
  'AFTER INSERT ON teams: ensures the owner holds a team_members row with role ''owner'', so team membership checks cannot be bypassed by a missing roster row.';

drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row
  execute function public.handle_new_team();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================================
-- PART 3: VIEWS (from 03_views.sql)
-- =============================================================================

DROP VIEW IF EXISTS public.tournament_standings;
CREATE OR REPLACE VIEW public.tournament_standings AS
WITH completed_results AS (
    SELECT
        f.tournament_id,
        f.home_participant_id,
        f.away_participant_id,
        r.home_score,
        r.away_score
    FROM public.fixtures f
    JOIN public.fixture_results r
      ON r.fixture_id = f.id
    WHERE r.home_score IS NOT NULL
      AND r.away_score IS NOT NULL
),
perspectives AS (
    SELECT
        c.tournament_id,
        c.home_participant_id                       AS participant_id,
        c.home_score::integer                       AS goals_for,
        c.away_score::integer                       AS goals_against,
        (c.home_score > c.away_score)               AS won,
        (c.home_score = c.away_score)               AS drew,
        (c.home_score < c.away_score)               AS lost
    FROM completed_results c
    UNION ALL
    SELECT
        c.tournament_id,
        c.away_participant_id                       AS participant_id,
        c.away_score::integer                       AS goals_for,
        c.home_score::integer                       AS goals_against,
        (c.away_score > c.home_score)               AS won,
        (c.home_score = c.away_score)               AS drew,
        (c.away_score < c.home_score)               AS lost
    FROM completed_results c
),
participant_totals AS (
    SELECT
        p.tournament_id,
        p.participant_id,
        count(*)::integer                                             AS played,
        count(*) FILTER (WHERE p.won)::integer                        AS won,
        count(*) FILTER (WHERE p.drew)::integer                       AS drew,
        count(*) FILTER (WHERE p.lost)::integer                       AS lost,
        COALESCE(sum(p.goals_for), 0)::integer                        AS goals_for,
        COALESCE(sum(p.goals_against), 0)::integer                    AS goals_against
    FROM perspectives p
    GROUP BY p.tournament_id, p.participant_id
)
SELECT
    tp.tournament_id,
    t.name                                       AS tournament_name,
    tp.id                                        AS participant_id,
    t.format                                     AS format,
    tp.status                                     AS status,
    COALESCE(a.played, 0)::integer                AS played,
    COALESCE(a.won, 0)::integer                   AS won,
    COALESCE(a.drew, 0)::integer                  AS drew,
    COALESCE(a.lost, 0)::integer                  AS lost,
    COALESCE(a.goals_for, 0)::integer             AS goals_for,
    COALESCE(a.goals_against, 0)::integer         AS goals_against,
    (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::integer AS goal_difference,
    CASE
        WHEN t.format = 'league' THEN (COALESCE(a.won, 0) * 3 + COALESCE(a.drew, 0))::integer
        ELSE COALESCE(a.won, 0)::integer
    END                                           AS points
FROM public.tournament_participants tp
JOIN public.tournaments t
  ON t.id = tp.tournament_id
LEFT JOIN participant_totals a
  ON a.tournament_id = tp.tournament_id
 AND a.participant_id = tp.id
WHERE tp.status <> 'withdrawn';

DROP VIEW IF EXISTS public.player_tournament_stats;
CREATE OR REPLACE VIEW public.player_tournament_stats AS
SELECT
    tp.user_id,
    p.id                                         AS profile_id,
    p.username,
    p.display_name,
    p.profile_picture,
    t.id                                         AS tournament_id,
    t.name                                       AS tournament_name,
    t.game,
    t.status                                     AS tournament_status,
    COALESCE(s.played, 0)::integer                AS played,
    COALESCE(s.won, 0)::integer                   AS won,
    COALESCE(s.drew, 0)::integer                  AS drew,
    COALESCE(s.lost, 0)::integer                  AS lost,
    COALESCE(s.goals_for, 0)::integer             AS goals_for,
    COALESCE(s.goals_against, 0)::integer         AS goals_against,
    COALESCE(s.goal_difference, 0)::integer       AS goal_difference,
    COALESCE(s.points, 0)::integer                AS points
FROM public.tournament_participants tp
JOIN public.profiles p
  ON p.id = tp.user_id
JOIN public.tournaments t
  ON t.id = tp.tournament_id
LEFT JOIN public.tournament_standings s
  ON s.participant_id = tp.id
 AND s.tournament_id = tp.tournament_id
WHERE tp.user_id IS NOT NULL
  AND tp.status <> 'withdrawn';

DROP VIEW IF EXISTS public.player_rankings;
CREATE OR REPLACE VIEW public.player_rankings AS
WITH career AS (
    SELECT
        pts.user_id,
        max(pts.username)                          AS username,
        max(pts.display_name)                      AS display_name,
        max(pts.profile_picture)                   AS profile_picture,
        count(*)::integer                          AS tournaments_entered,
        COALESCE(sum(pts.played), 0)::integer       AS played,
        COALESCE(sum(pts.won), 0)::integer          AS won,
        COALESCE(sum(pts.drew), 0)::integer         AS drew,
        COALESCE(sum(pts.lost), 0)::integer         AS lost,
        COALESCE(sum(pts.goals_for), 0)::integer    AS goals_for,
        COALESCE(sum(pts.goals_against), 0)::integer AS goals_against,
        COALESCE(sum(pts.points), 0)::integer       AS points
    FROM public.player_tournament_stats pts
    GROUP BY pts.user_id
)
SELECT
    rank() OVER (
        ORDER BY
            points DESC,
            won DESC,
            (goals_for - goals_against) DESC,
            goals_for DESC
    )::integer                                    AS rank,
    user_id,
    username,
    display_name,
    profile_picture,
    tournaments_entered,
    played,
    won,
    drew,
    lost,
    goals_for,
    goals_against,
    (goals_for - goals_against)::integer          AS goal_difference,
    points,
    COALESCE(
        round(won::numeric / NULLIF(played, 0) * 100, 1),
        0
    )                                             AS win_rate
FROM career;

-- =============================================================================
-- PART 4: RLS POLICIES AND GRANTS (from 04_rls_grants.sql)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members            ENABLE ROW LEVEL SECURITY;

-- Policy sweep
do $$
declare
  t text;
  p record;
begin
  foreach t in array ARRAY[
    'profiles', 'tournaments', 'tournament_participants',
    'fixtures', 'fixture_results', 'teams', 'team_members'
  ] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end
$$;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles"          ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"       ON public.profiles;

CREATE POLICY "Anyone can view profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tournaments policies
DROP POLICY IF EXISTS "Anyone can view tournaments"   ON public.tournaments;
DROP POLICY IF EXISTS "Users can create tournaments"  ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can delete tournaments" ON public.tournaments;

CREATE POLICY "Anyone can view tournaments"
  ON public.tournaments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create tournaments"
  ON public.tournaments
  FOR INSERT
  WITH CHECK (organizer_id = public.current_profile_id());

CREATE POLICY "Organizers can update tournaments"
  ON public.tournaments
  FOR UPDATE
  USING (organizer_id = public.current_profile_id())
  WITH CHECK (organizer_id = public.current_profile_id());

CREATE POLICY "Organizers can delete tournaments"
  ON public.tournaments
  FOR DELETE
  USING (organizer_id = public.current_profile_id());

-- Tournament participants policies
DROP POLICY IF EXISTS "Anyone can view tournament participants"     ON public.tournament_participants;
DROP POLICY IF EXISTS "Users can join tournaments"                 ON public.tournament_participants;
DROP POLICY IF EXISTS "Participants can update their registration" ON public.tournament_participants;
DROP POLICY IF EXISTS "Users can leave tournaments"                ON public.tournament_participants;

CREATE POLICY "Anyone can view tournament participants"
  ON public.tournament_participants
  FOR SELECT
  USING (true);

CREATE POLICY "Users can join tournaments"
  ON public.tournament_participants
  FOR INSERT
  WITH CHECK (
    (user_id = public.current_profile_id()
     OR (team_id IS NOT NULL AND public.is_team_member(team_id)))
    AND public.can_join_tournament(tournament_id)
  );

CREATE POLICY "Participants can update their registration"
  ON public.tournament_participants
  FOR UPDATE
  USING (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

CREATE POLICY "Users can leave tournaments"
  ON public.tournament_participants
  FOR DELETE
  USING (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

-- Fixtures policies
DROP POLICY IF EXISTS "Anyone can view fixtures"       ON public.fixtures;
DROP POLICY IF EXISTS "Organizers can create fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Organizers can update fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Organizers can delete fixtures" ON public.fixtures;

CREATE POLICY "Anyone can view fixtures"
  ON public.fixtures
  FOR SELECT
  USING (true);

CREATE POLICY "Organizers can create fixtures"
  ON public.fixtures
  FOR INSERT
  WITH CHECK (public.is_tournament_organizer(tournament_id));

CREATE POLICY "Organizers can update fixtures"
  ON public.fixtures
  FOR UPDATE
  USING (public.is_tournament_organizer(tournament_id))
  WITH CHECK (public.is_tournament_organizer(tournament_id));

CREATE POLICY "Organizers can delete fixtures"
  ON public.fixtures
  FOR DELETE
  USING (public.is_tournament_organizer(tournament_id));

-- Fixture results policies
DROP POLICY IF EXISTS "Anyone can view fixture results" ON public.fixture_results;
DROP POLICY IF EXISTS "Participants and organizers can submit results" ON public.fixture_results;

CREATE POLICY "Anyone can view fixture results"
  ON public.fixture_results
  FOR SELECT
  USING (true);

CREATE POLICY "Participants and organizers can submit results"
  ON public.fixture_results
  FOR INSERT
  WITH CHECK (
    submitted_by = public.current_profile_id()
    AND (
      public.is_tournament_organizer(
        (SELECT f.tournament_id FROM public.fixtures f WHERE f.id = fixture_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.fixtures f
        JOIN public.tournament_participants tp
          ON tp.id IN (f.home_participant_id, f.away_participant_id)
        WHERE f.id = fixture_id
          AND tp.user_id = public.current_profile_id()
      )
    )
    AND (home_score IS NULL OR home_score >= 0)
    AND (away_score IS NULL OR away_score >= 0)
  );

DROP POLICY IF EXISTS "Participants and organizers can update results" ON public.fixture_results;

CREATE POLICY "Participants and organizers can update results"
  ON public.fixture_results
  FOR UPDATE
  USING (
    submitted_by = public.current_profile_id()
    AND (
      public.is_tournament_organizer(
        (SELECT f.tournament_id FROM public.fixtures f WHERE f.id = fixture_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.fixtures f
        JOIN public.tournament_participants tp
          ON tp.id IN (f.home_participant_id, f.away_participant_id)
        WHERE f.id = fixture_id
          AND tp.user_id = public.current_profile_id()
      )
    )
  )
  WITH CHECK (
    submitted_by = public.current_profile_id()
    AND (
      public.is_tournament_organizer(
        (SELECT f.tournament_id FROM public.fixtures f WHERE f.id = fixture_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.fixtures f
        JOIN public.tournament_participants tp
          ON tp.id IN (f.home_participant_id, f.away_participant_id)
        WHERE f.id = fixture_id
          AND tp.user_id = public.current_profile_id()
      )
    )
    AND (home_score IS NULL OR home_score >= 0)
    AND (away_score IS NULL OR away_score >= 0)
  );

-- Teams policies
DROP POLICY IF EXISTS "Anyone can view teams"      ON public.teams;
DROP POLICY IF EXISTS "Users can create teams"     ON public.teams;
DROP POLICY IF EXISTS "Team owners can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;

CREATE POLICY "Anyone can view teams"
  ON public.teams
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (owner_id = public.current_profile_id());

CREATE POLICY "Team owners can update teams"
  ON public.teams
  FOR UPDATE
  USING (public.is_team_owner(id))
  WITH CHECK (public.is_team_owner(id));

CREATE POLICY "Team owners can delete teams"
  ON public.teams
  FOR DELETE
  USING (public.is_team_owner(id));

-- Team members policies
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can join teams"          ON public.team_members;
DROP POLICY IF EXISTS "Members can leave teams"       ON public.team_members;

CREATE POLICY "Anyone can view team members"
  ON public.team_members
  FOR SELECT
  USING (true);

CREATE POLICY "Users can join teams"
  ON public.team_members
  FOR INSERT
  WITH CHECK (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

CREATE POLICY "Members can leave teams"
  ON public.team_members
  FOR DELETE
  USING (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON
    public.tournaments,
    public.tournament_participants,
    public.fixtures,
    public.fixture_results,
    public.teams,
    public.team_members
  TO authenticated;

GRANT SELECT ON
    public.tournament_standings,
    public.player_tournament_stats,
    public.player_rankings
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_fixtures(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_round(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id()          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tournament_organizer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_tournament(uuid)     TO authenticated;

-- =============================================================================
-- End of complete schema
-- =============================================================================
