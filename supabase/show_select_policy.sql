-- =============================================================================
-- SHOW SELECT POLICY DEFINITION ONLY
-- This is the critical information needed to diagnose the 403
-- =============================================================================

SELECT
  policyname,
  cmd,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
  AND cmd = 'SELECT';
