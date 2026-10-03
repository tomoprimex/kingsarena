-- =============================================================================
-- AUTO-ADD ORGANIZER AS TOURNAMENT PARTICIPANT
-- Trigger to automatically add tournament creator as first participant
-- =============================================================================

-- Function to handle new tournament creation
CREATE OR REPLACE FUNCTION public.handle_new_tournament()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Automatically add the organizer as the first participant
  INSERT INTO public.tournament_participants (
    tournament_id,
    user_id,
    status
  )
  VALUES (
    NEW.id,
    NEW.organizer_id,
    'registered'
  )
  ON CONFLICT (tournament_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_tournament_created ON public.tournaments;

-- Create trigger
CREATE TRIGGER on_tournament_created
  AFTER INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tournament();
