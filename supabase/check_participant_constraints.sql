-- =============================================================================
-- CHECK TOURNAMENT_PARTICIPANTS CONSTRAINTS
-- Shows all unique constraints and indexes
-- =============================================================================

-- 1. Show all unique constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'tournament_participants')
  AND contype = 'u';

-- 2. Show all indexes
SELECT
  indexname as index_name,
  indexdef as index_definition
FROM pg_indexes
WHERE tablename = 'tournament_participants'
  AND schemaname = 'public';

-- 3. Show all check constraints
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'tournament_participants')
  AND contype = 'c';

-- 4. Verify tournaments.organizer_id references profiles.id (not teams)
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'tournaments')
  AND contype = 'f'
  AND conname LIKE '%organizer%';
