-- =============================================================================
-- SIMPLE READ-ONLY TEST
-- Verifies database is responsive before running diagnostics
-- =============================================================================

-- Test 1: Simple count check
SELECT
  'Database is responsive' as test,
  1 as result;

-- Test 2: Check if tournament_participants exists
SELECT
  'tournament_participants exists' as test,
  COUNT(*) as result
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'tournament_participants';

-- Test 3: Check if RLS is enabled on tournament_participants
SELECT
  'RLS enabled on tournament_participants' as test,
  relrowsecurity as result
FROM pg_class
WHERE relname = 'tournament_participants';
