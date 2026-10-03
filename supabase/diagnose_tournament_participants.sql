-- =============================================================================
-- DIAGNOSTIC SCRIPT - DO NOT MAKE CHANGES
-- Run this in Supabase SQL Editor to inspect current database state
-- =============================================================================

-- 1. Check if tournament_participants table exists
SELECT
  'Table exists' as check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tournament_participants')
    THEN 'YES'
    ELSE 'NO'
  END as result;

-- 2. Check RLS status
SELECT
  'RLS enabled' as check_item,
  CASE
    WHEN relrowsecurity = true THEN 'YES'
    ELSE 'NO'
  END as result
FROM pg_class
WHERE relname = 'tournament_participants';

-- 3. List current RLS policies
SELECT
  'Current RLS policies' as check_item,
  policyname as policy_name,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tournament_participants';

-- 4. Check current grants
SELECT
  'Grants for tournament_participants' as check_item,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'tournament_participants'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- 5. Check if helper functions exist
SELECT
  'Helper functions exist' as check_item,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'current_profile_id',
    'is_team_member',
    'is_team_owner',
    'can_join_tournament'
  );

-- 6. Check function execution grants
SELECT
  'Function execution grants' as check_item,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'current_profile_id',
    'is_team_member',
    'is_team_owner',
    'can_join_tournament'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY routine_name, grantee;

-- 7. Check table columns
SELECT
  'Table columns' as check_item,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tournament_participants'
ORDER BY ordinal_position;

-- 8. Check foreign key constraints
SELECT
  'Foreign keys' as check_item,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'tournament_participants';

-- 9. Test if anon can select (simulated)
DO $$
DECLARE
  v_has_policy boolean;
  v_policy_count integer;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'tournament_participants'
    AND cmd = 'SELECT';

  RAISE NOTICE 'Number of SELECT policies: %', v_policy_count;

  IF v_policy_count = 0 THEN
    RAISE NOTICE 'DIAGNOSIS: No SELECT policy exists - this causes 403 for anon users when RLS is enabled';
  ELSE
    SELECT bool_or(qual = 'true'::text) INTO v_has_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tournament_participants'
      AND cmd = 'SELECT';

    IF v_has_policy THEN
      RAISE NOTICE 'DIAGNOSIS: SELECT policy with USING (true) exists - should allow reads';
    ELSE
      RAISE NOTICE 'DIAGNOSIS: SELECT policies exist but none allow unfiltered access - may cause 403';
    END IF;
  END IF;
END $$;
