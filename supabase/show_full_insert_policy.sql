-- =============================================================================
-- SHOW FULL INSERT POLICY WITH CHECK
-- Gets the full expression without truncation
-- =============================================================================

SELECT
  policyname,
  cmd,
  pg_get_expr(qual, pg_class.oid) as using_expression,
  pg_get_expr(with_check, pg_class.oid) as with_check_expression
FROM pg_policies
JOIN pg_class ON pg_class.relname = tablename AND pg_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE schemaname = 'public'
  AND tablename = 'tournament_participants'
  AND cmd = 'INSERT';
