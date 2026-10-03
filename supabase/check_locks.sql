-- =============================================================================
-- READ-ONLY LOCK DIAGNOSTIC
-- Identifies active sessions, locks, and blocking processes
-- Makes NO changes to the database
-- =============================================================================

-- 1. Check all active sessions
SELECT
  pid,
  state,
  application_name,
  client_addr,
  backend_start,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY backend_start;

-- 2. Check all locks in the current database
SELECT
  locktype,
  database,
  relation,
  page,
  tuple,
  virtualxid,
  transactionid,
  classid,
  objid,
  objsubid,
  virtualtransaction,
  pid,
  mode,
  granted,
  fastpath
FROM pg_locks
WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY pid, granted;

-- 3. Identify the specific blocking processes (198404 and 198395)
SELECT
  'Specific blocking processes' as info,
  pid,
  state,
  application_name,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  LEFT(query, 200) as query_preview
FROM pg_stat_activity
WHERE pid IN (198404, 198395);

-- 4. Check what relations are being locked by these processes
SELECT
  'Locks by blocking processes' as info,
  l.pid,
  l.locktype,
  l.mode,
  l.granted,
  CASE
    WHEN l.relation IS NOT NULL THEN
      (SELECT relname FROM pg_class WHERE oid = l.relation)
    ELSE NULL
  END as relation_name,
  CASE
    WHEN l.relation IS NOT NULL THEN
      (SELECT n.nspname FROM pg_namespace n JOIN pg_class c ON c.relnamespace = n.oid WHERE c.oid = l.relation)
    ELSE NULL
  END as schema_name
FROM pg_locks l
WHERE l.pid IN (198404, 198395)
  AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY l.pid, l.granted;

-- 5. Check relation IDs 17658 and 17638 (from the deadlock error)
SELECT
  'Relations from deadlock error' as info,
  oid,
  relname,
  relkind,
  relnamespace,
  (SELECT nspname FROM pg_namespace WHERE oid = relnamespace) as schema_name
FROM pg_class
WHERE oid IN (17658, 17638);

-- 6. Check for any waiting/blocked queries
SELECT
  'Blocked queries' as info,
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS current_statement_in_blocking_process,
  blocked_activity.application_name AS blocked_application,
  blocking_activity.application_name AS blocking_application
FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
