-- =============================================================================
-- CHECK INSERT POLICY DEFINITION
-- Shows the exact INSERT policy and its WITH CHECK condition
-- =============================================================================

-- 1. Show the exact INSERT policy definition
SELECT
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
  AND cmd = 'INSERT';

-- 2. Check if current_profile_id() is working correctly
-- This simulates what the policy does
SELECT
  'current_profile_id test' as test,
  public.current_profile_id() as result;

-- 3. Check the actual columns in tournament_participants
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tournament_participants'
ORDER BY ordinal_position;
