-- =============================================================================
-- DIAGNOSE INSERT POLICY CONDITIONS
-- Tests the actual conditions with the real tournament and profile IDs
-- =============================================================================

-- Variables (replace with actual values)
DO $$
DECLARE
  v_tournament_id uuid := '91b48f08-c484-4ddd-981f-5d90dcc5e164'::uuid;
  v_profile_id uuid := 'ac1ed1ec-b7e4-4e85-8e16-6f91cd94a337'::uuid;
  v_current_profile_id uuid;
  v_can_join boolean;
  v_tournament_status text;
  v_tournament_deadline timestamptz;
  v_tournament_max_participants integer;
  v_current_participant_count integer;
BEGIN
  -- 1. Get current_profile_id() for the authenticated user
  -- Note: This will be NULL in SQL Editor, but we can test the function logic
  SELECT public.current_profile_id() INTO v_current_profile_id;
  RAISE NOTICE 'current_profile_id() returns: %', v_current_profile_id;
  RAISE NOTICE 'Profile ID being inserted: %', v_profile_id;
  RAISE NOTICE 'Do they match? %', (v_current_profile_id = v_profile_id);

  -- 2. Test can_join_tournament()
  SELECT public.can_join_tournament(v_tournament_id) INTO v_can_join;
  RAISE NOTICE 'can_join_tournament() returns: %', v_can_join;

  -- 3. Inspect the tournament row
  SELECT
    t.status,
    t.registration_deadline,
    t.max_participants
  INTO v_tournament_status, v_tournament_deadline, v_tournament_max_participants
  FROM public.tournaments t
  WHERE t.id = v_tournament_id;

  RAISE NOTICE 'Tournament status: %', v_tournament_status;
  RAISE NOTICE 'Tournament registration deadline: %', v_tournament_deadline;
  RAISE NOTICE 'Tournament max participants: %', v_tournament_max_participants;

  -- 4. Count current participants
  SELECT COUNT(*)
  INTO v_current_participant_count
  FROM public.tournament_participants tp
  WHERE tp.tournament_id = v_tournament_id;

  RAISE NOTICE 'Current participant count: %', v_current_participant_count;

  -- 5. Evaluate individual conditions
  RAISE NOTICE 'Condition 1: status in (upcoming, registration): %',
    (v_tournament_status IN ('upcoming', 'registration'));
  RAISE NOTICE 'Condition 2: deadline not passed: %',
    (v_tournament_deadline IS NULL OR v_tournament_deadline >= now());
  RAISE NOTICE 'Condition 3: under max participants: %',
    (v_tournament_max_participants IS NULL OR v_current_participant_count < v_tournament_max_participants);

  -- 6. Check if the profile exists
  RAISE NOTICE 'Profile exists in profiles table: %',
    (SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_profile_id));

  -- 7. Check the mapping between auth.users and profiles
  RAISE NOTICE 'Profile user_id maps to auth.users: %',
    (SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.id = v_profile_id
    ));
END $$;
