-- =============================================================================
-- 02_functions.sql - helper, trigger and fixture-generation functions.
--
-- Every function is SECURITY DEFINER with search_path pinned to public, pg_temp
-- so callers cannot be influenced by their own session search_path.
--
-- THE CORE BUG THIS FILE FIXES: public.profiles.id is a random uuid and is NOT
-- the auth user id (that lives in profiles.user_id). Any policy or query that
-- compares auth.uid() to a profiles.id value never matches, so nothing a user
-- owns was ever visible to them. public.current_profile_id() below is the single
-- translation point and is used by every function here and (in
-- 04_rls_grants.sql) by every repaired policy.
-- =============================================================================


-- =============================================================================
-- 1. IDENTITY HELPERS
-- =============================================================================

-- Returns the profiles.id of the signed-in user, or NULL when not signed in.
-- Stable so it can be used inside indexes/policies without volatile semantics.
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


-- True when the caller organizes the given tournament.
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


-- True when the caller owns the given team.
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


-- True when the caller is on the given team roster. Works for any role
-- (owner, captain, member).
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


-- Can the caller still enter this tournament?
-- SECURITY DEFINER is REQUIRED here, not merely convenient: an RLS policy on
-- tournament_participants cannot itself subquery tournament_participants
-- without infinite recursion, so the count check has to live in a definer
-- function that bypasses the caller's policies.
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


-- Safely coerce a text value to boolean. Never raises: unrecognised literals
-- (including NULL) collapse to false. Used by handle_new_user() so a malformed
-- client payload (e.g. "game_dls": "on") cannot abort signup.
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

-- =============================================================================
-- 2. SIGNUP TRIGGER
-- =============================================================================

-- Creates the profile row for a new auth user.
--
-- CRITICAL: this function must never raise. It runs inside the auth.users
-- INSERT, so ANY exception (including one raised by the uniqueness loop below
-- under pathological input) would roll back the entire user creation and leave
-- the user unable to sign in. Everything is therefore wrapped in an exception
-- handler that swallows errors and still returns NEW.
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
    -- Prefer the username from the signup form; fall back to the email local part.
    base_username := left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      20
    );

    -- Defensive: never insert an empty username into a NOT NULL UNIQUE column.
    if base_username is null or btrim(base_username) = '' then
      base_username := 'player' || left(replace(new.id::text, '-', ''), 8);
    end if;

    -- profiles.username is UNIQUE. Append an increasing numeric suffix until we
    -- find a free slot instead of letting the collision abort signup.
    final_username := base_username;
    while exists (select 1 from public.profiles where username = final_username) loop
      suffix := suffix + 1;
      -- Guard the prefix length: left() with a 0/negative count returns '' or a
      -- non-prefix slice, which can collide and spin the loop to its cap.
      -- greatest(1, ...) guarantees a non-empty prefix, and the outer left(...)
      -- guarantees the result never exceeds the 20-char username limit.
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
      -- Swallow on purpose: losing a profile is recoverable, losing the auth
      -- user is not. The user can be backfilled by an admin later.
      raise warning 'handle_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- =============================================================================
-- 3. FIXTURE RESULT SYNC
-- =============================================================================

-- Promotes a fixture to 'completed' the moment both scores are known.
-- No handling is needed for DELETE: in normal flow results are submitted, not
-- deleted, and fixtures are never removed by a result delete.
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


-- =============================================================================
-- 4. FIXTURE GENERATION
-- =============================================================================

-- Builds the opening round for a tournament. Organizer only.
-- Returns the number of fixtures inserted.
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
  -- Lock the tournament row so two concurrent calls cannot both build a bracket.
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

  -- Seed order first, then registration order: deterministic and fair.
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
    -- FULL round-robin: every unordered pair plays exactly once, all in round 1.
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
    -- knockout / group_knockout: round 1 only, consecutive pairing.
    -- With an odd field the last participant gets a bye (no fixture created).
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


-- Builds the next elimination round from the participants still alive.
-- Organizer only. Returns the number of fixtures inserted.
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

  -- Losers of matches that have actually been played are out. Ties eliminate
  -- nobody, so both sides stay alive.
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

  -- Continue the tournament-wide match numbering.
  select coalesce(max(f.match_number), 0) + 1
    into v_match_no
  from public.fixtures f
  where f.tournament_id = p_tournament_id;

  -- Consecutive pairing; an odd survivor gets a bye and no fixture.
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


-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- Generic updated_at maintenance.
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


-- Keep updated_at fresh on every mutable table.
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


-- Mirror result submissions onto the fixture status.
drop trigger if exists on_fixture_result_sync on public.fixture_results;
create trigger on_fixture_result_sync
  after insert or update on public.fixture_results
  for each row
  execute function public.sync_fixture_status();


-- The team owner is always a member of their own team.
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


-- Recreate the signup trigger on auth.users so it points at the hardened
-- version of handle_new_user() defined above.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
