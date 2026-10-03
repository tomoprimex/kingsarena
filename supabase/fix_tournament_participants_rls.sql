-- =============================================================================
-- Fix Tournament Participants RLS Policies Only
-- Run this if you already have the tables and just need to fix RLS
-- =============================================================================

-- Step 1: Ensure RLS is enabled
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Step 2: Sweep all existing policies (defensive cleanup)
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='tournament_participants'
  loop
    execute format('drop policy if exists %I on public.tournament_participants', p.policyname);
  end loop;
end
$$;

-- Step 3: Create the correct RLS policies

-- SELECT: Anyone can view tournament participants (public tournament info)
CREATE POLICY "Anyone can view tournament participants"
  ON public.tournament_participants
  FOR SELECT
  USING (true);

-- INSERT: Users can join tournaments if they own the profile/team and tournament is open
CREATE POLICY "Users can join tournaments"
  ON public.tournament_participants
  FOR INSERT
  WITH CHECK (
    (user_id = public.current_profile_id()
     OR (team_id IS NOT NULL AND public.is_team_member(team_id)))
    AND public.can_join_tournament(tournament_id)
  );

-- UPDATE: Users can update their own registration or team owners can update
CREATE POLICY "Participants can update their registration"
  ON public.tournament_participants
  FOR UPDATE
  USING (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

-- DELETE: Users can leave their own registration or team owners can remove
CREATE POLICY "Users can leave tournaments"
  ON public.tournament_participants
  FOR DELETE
  USING (user_id = public.current_profile_id() OR public.is_team_owner(team_id));

-- Step 4: Ensure grants are correct
GRANT SELECT ON public.tournament_participants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournament_participants TO authenticated;

-- Step 5: Ensure function grants are correct
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_tournament(uuid) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Tournament participants RLS policies fixed successfully.';
END $$;
