-- =============================================================================
-- SHOW INSERT POLICY ONLY
-- This is the critical information needed to diagnose the INSERT 403
-- =============================================================================

SELECT
  policyname,
  cmd,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
  AND cmd = 'INSERT';
