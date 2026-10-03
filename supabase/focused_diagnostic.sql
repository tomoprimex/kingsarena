-- =============================================================================
-- FOCUSED DIAGNOSTIC - Single Result Set
-- Returns all critical info to diagnose 403 error
-- =============================================================================

WITH table_info AS (
  SELECT
    'RLS enabled' as category,
    CASE WHEN relrowsecurity THEN 'YES' ELSE 'NO' END as info
  FROM pg_class WHERE relname = 'tournament_participants'
),
policies AS (
  SELECT
    'SELECT policies' as category,
    COUNT(*)::text as info
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'tournament_participants'
    AND cmd = 'SELECT'
),
select_policy_allows as (
  SELECT
    'SELECT policy allows reads' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tournament_participants'
        AND cmd = 'SELECT'
        AND qual = 'true'::text
    ) THEN 'YES' ELSE 'NO' END as info
),
grants AS (
  SELECT
    'SELECT grant for anon' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'tournament_participants'
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'SELECT grant for authenticated' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'tournament_participants'
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) THEN 'YES' ELSE 'NO' END as info
),
functions AS (
  SELECT
    'Function: current_profile_id exists' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'current_profile_id'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'Function: is_team_member exists' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'is_team_member'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'Function: is_team_owner exists' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'is_team_owner'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'Function: can_join_tournament exists' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'can_join_tournament'
    ) THEN 'YES' ELSE 'NO' END as info
),
function_grants AS (
  SELECT
    'current_profile_id grant for anon' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'current_profile_id'
        AND grantee = 'anon'
        AND privilege_type = 'EXECUTE'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'current_profile_id grant for authenticated' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'current_profile_id'
        AND grantee = 'authenticated'
        AND privilege_type = 'EXECUTE'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'is_team_member grant for authenticated' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'is_team_member'
        AND grantee = 'authenticated'
        AND privilege_type = 'EXECUTE'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'is_team_owner grant for authenticated' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'is_team_owner'
        AND grantee = 'authenticated'
        AND privilege_type = 'EXECUTE'
    ) THEN 'YES' ELSE 'NO' END as info
  UNION ALL
  SELECT
    'can_join_tournament grant for authenticated' as category,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'can_join_tournament'
        AND grantee = 'authenticated'
        AND privilege_type = 'EXECUTE'
    ) THEN 'YES' ELSE 'NO' END as info
)
SELECT * FROM table_info
UNION ALL
SELECT * FROM policies
UNION ALL
SELECT * FROM select_policy_allows
UNION ALL
SELECT * FROM grants
UNION ALL
SELECT * FROM functions
UNION ALL
SELECT * FROM function_grants
ORDER BY category;
