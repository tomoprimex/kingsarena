// Read models for the organizer control centre (/admin/tournaments).
//
// The public tournament detail screen already exposes everything the control
// centre needs per tournament, so only the organizer's own list lives here.
// Every value returned is read from the database at query time.
import { getSupabase, isSupabaseConfigured } from '../supabase';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const ORGANIZED_SELECT = [
  'id',
  'name',
  'game',
  'image_url',
  'format',
  'status',
  'entry_fee',
  'prize_pool',
  'max_participants',
  'start_date',
  'registration_deadline',
  'created_at',
  'updated_at',
  'participants:tournament_participants (id, status)',
  'fixtures (id, status)',
].join(', ');

const LIVE_STATUSES = ['registration', 'ongoing'];

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}

async function resolveProfile(supabase, userId) {
  if (!userId) return { profile: null, error: { message: 'A profile is required.' } };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) return { profile: null, error };
  if (!data) {
    return { profile: null, error: { message: 'No profile is linked to this account yet.' } };
  }
  return { profile: data, error: null };
}

function summarise(tournament) {
  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const fixtures = Array.isArray(tournament.fixtures) ? tournament.fixtures : [];

  return {
    ...tournament,
    participants: undefined,
    fixtures: undefined,
    participant_count: participants.length,
    fixture_count: fixtures.length,
    played_count: fixtures.filter((fixture) => fixture.status === 'completed').length,
    live: LIVE_STATUSES.includes(tournament.status),
  };
}

export async function fetchOrganizedTournaments(userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { profile, error: profileError } = await resolveProfile(supabase, userId);
  if (profileError) return { data: null, error: profileError };

  const { data, error } = await supabase
    .from('tournaments')
    .select(ORGANIZED_SELECT)
    .eq('organizer_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { data: null, error };

  const rows = (data ?? []).map(summarise);
  return {
    data: {
      profile,
      rows,
      totals: {
        tournaments: rows.length,
        live: rows.filter((row) => row.live).length,
        participants: rows.reduce((sum, row) => sum + row.participant_count, 0),
        fixtures: rows.reduce((sum, row) => sum + row.fixture_count, 0),
        played: rows.reduce((sum, row) => sum + row.played_count, 0),
      },
    },
    error: null,
  };
}