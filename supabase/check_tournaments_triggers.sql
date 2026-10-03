-- =============================================================================
-- CHECK TRIGGERS ON TOURNAMENTS TABLE
-- Shows any triggers that might auto-add organizer as participant
-- =============================================================================

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'tournaments';
