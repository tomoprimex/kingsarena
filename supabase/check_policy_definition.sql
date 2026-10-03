-- =============================================================================
-- CHECK EXACT SELECT POLICY DEFINITION
-- Shows the actual USING expression of the SELECT policy
-- =============================================================================

-- 1. Show the exact SELECT policy definition
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
  AND cmd = 'SELECT';

-- 2. Show all policies on tournament_participants (not just SELECT)
SELECT
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
ORDER BY cmd, policyname;

-- 3. Check if table is exposed in PostgREST (check for api schema)
SELECT
  'Table in api schema' as check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'api' AND table_name = 'tournament_participants'
    ) THEN 'YES'
    ELSE 'NO'
  END as result;

-- 4. Check actual column names in the table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tournament_participants'
ORDER BY ordinal_position;

-- 5. Check if there's a view with the same name that might be interfering
SELECT
  'View with same name' as check,
  table_name,
  table_schema
FROM information_schema.views
WHERE table_name = 'tournament_participants';

-- 6. Check if there are any security definer functions in the policy that might fail
SELECT
  'Functions used in policies' as check,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('current_profile_id', 'is_team_member', 'is_team_owner', 'can_join_tournament')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
