-- =============================================================================
-- SHOW can_join_tournament FUNCTION DEFINITION
-- Shows the complete function and all its conditions
-- =============================================================================

SELECT
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'can_join_tournament'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
