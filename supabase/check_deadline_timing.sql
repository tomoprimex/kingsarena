-- =============================================================================
-- CHECK DEADLINE TIMING
-- Compares current time with tournament registration deadline
-- =============================================================================

DO $$
DECLARE
  v_tournament_id uuid := '91b48f08-c484-4ddd-981f-5d90dcc5e164'::uuid;
  v_deadline timestamptz;
  v_now timestamptz;
  v_status text;
BEGIN
  SELECT
    t.registration_deadline,
    t.status
  INTO v_deadline, v_status
  FROM public.tournaments t
  WHERE t.id = v_tournament_id;

  v_now := now();

  RAISE NOTICE 'Current time (UTC): %', v_now;
  RAISE NOTICE 'Tournament deadline: %', v_deadline;
  RAISE NOTICE 'Tournament status: %', v_status;
  RAISE NOTICE 'Deadline >= now(): %', (v_deadline >= v_now);
  RAISE NOTICE 'Deadline is NULL: %', (v_deadline IS NULL);
  RAISE NOTICE 'Time until deadline: %', (v_deadline - v_now);
END $$;
