import { getSupabase, isSupabaseConfigured } from '../supabase';
import { getAuthErrorMessage } from '../../contexts/AuthContext';
import {
  GAME_VALUES,
  PARTICIPANT_STATUS_VALUES,
  TOURNAMENT_FORMAT_VALUES,
  TOURNAMENT_STATUS_VALUES,
} from '../constants';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

const TOURNAMENT_COLUMNS =
  'id, name, description, game, image_url, format, status, rules, entry_fee, prize_pool, max_participants, start_date, end_date, registration_deadline, created_at, updated_at';

const PARTICIPANT_COLUMNS = 'id, tournament_id, user_id, team_id, status, seed, joined_at';

const RESULT_COLUMNS =
  'fixture_id, home_score, away_score, submitted_by, submitted_at, status, notes, updated_at';

const UPDATABLE_TOURNAMENT_FIELDS = [
  'name',
  'description',
  'game',
  'image_url',
  'format',
  'status',
  'rules',
  'entry_fee',
  'prize_pool',
  'max_participants',
  'start_date',
  'end_date',
  'registration_deadline',
];

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}

function fail(message) {
  return { data: null, error: { message } };
}

function describe(error) {
  if (!error) return null;
  return { ...error, message: getAuthErrorMessage(error) };
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function isWholeNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isInteger(parsed) && parsed >= 0;
}

function normaliseImageUrl(value) {
  return emptyToNull(trimmed(value));
}

// tournaments_image_url_check only accepts http(s) URLs, so the same rule is
// enforced here to return a readable message instead of a raw constraint error.
function isValidImageUrl(value) {
  if (value === null) return true;
  return /^https?:\/\/[^\s]+$/i.test(value);
}

function invalidImageUrl() {
  return fail('Cover image must be a full http:// or https:// URL, or left blank.');
}

function isValidDate(value) {
  return !Number.isNaN(new Date(value).getTime());
}

export async function createTournament(values) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const input = values ?? {};
  const name = trimmed(input.name);
  const startDate = emptyToNull(input.start_date);
  const endDate = emptyToNull(input.end_date);

  if (!input.profileId) return fail('A profile is required to create a tournament.');
  if (!name || name.length < 3) return fail('Tournament name must be at least 3 characters.');
  if (name.length > 80) return fail('Tournament name must be 80 characters or fewer.');
  if (!GAME_VALUES.includes(input.game)) return fail('Choose a game for this tournament.');
  if (input.format && !TOURNAMENT_FORMAT_VALUES.includes(input.format)) {
    return fail('Choose a valid tournament format.');
  }
  if (input.status && !TOURNAMENT_STATUS_VALUES.includes(input.status)) {
    return fail('Choose a valid tournament status.');
  }
  if (input.entry_fee != null && input.entry_fee !== '' && Number(input.entry_fee) < 0) {
    return fail('Entry fee cannot be negative.');
  }
  if (input.prize_pool != null && input.prize_pool !== '' && Number(input.prize_pool) < 0) {
    return fail('Prize pool cannot be negative.');
  }
  if (
    input.max_participants != null &&
    input.max_participants !== '' &&
    (!isWholeNumber(input.max_participants) || Number(input.max_participants) <= 1)
  ) {
    return fail('Maximum participants must be a whole number greater than 1.');
  }
  if (startDate && !isValidDate(startDate)) return fail('Start date is not a valid date.');
  if (endDate && !isValidDate(endDate)) return fail('End date is not a valid date.');
  const imageUrl = normaliseImageUrl(input.image_url);
  if (!isValidImageUrl(imageUrl)) return invalidImageUrl();
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return fail('The end date must be on or after the start date.');
  }

  const payload = {
    organizer_id: input.profileId,
    name,
    description: emptyToNull(input.description),
    game: input.game,
    image_url: imageUrl,
    format: input.format || 'league',
    status: input.status || 'upcoming',
    rules: emptyToNull(input.rules),
    entry_fee: input.entry_fee === '' || input.entry_fee == null ? 0 : Number(input.entry_fee),
    prize_pool: input.prize_pool === '' || input.prize_pool == null ? 0 : Number(input.prize_pool),
    max_participants:
      input.max_participants == null || input.max_participants === ''
        ? null
        : Number(input.max_participants),
    start_date: startDate,
    end_date: endDate,
    registration_deadline: emptyToNull(input.registration_deadline),
  };

  const { data, error } = await supabase
    .from('tournaments')
    .insert(payload)
    .select(TOURNAMENT_COLUMNS)
    .single();

  if (error) return { data: null, error: describe(error) };
  return { data, error: null };
}

export async function updateTournament(id, values) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return fail('A tournament id is required.');

  const payload = {};
  UPDATABLE_TOURNAMENT_FIELDS.forEach((field) => {
    if (values && Object.prototype.hasOwnProperty.call(values, field)) {
      if (field === 'image_url') payload[field] = normaliseImageUrl(values[field]);
      else payload[field] = field === 'name' ? trimmed(values[field]) : values[field];
    }
  });

  if (Object.keys(payload).length === 0) return fail('There is nothing to update.');
  if (payload.game && !GAME_VALUES.includes(payload.game)) return fail('Choose a valid game.');
  if (payload.format && !TOURNAMENT_FORMAT_VALUES.includes(payload.format)) {
    return fail('Choose a valid tournament format.');
  }
  if (payload.status && !TOURNAMENT_STATUS_VALUES.includes(payload.status)) {
    return fail('Choose a valid tournament status.');
  }
  if (!isValidImageUrl(payload.image_url)) return invalidImageUrl();
  if (payload.name !== undefined && (!payload.name || payload.name.length < 3)) {
    return fail('Tournament name must be at least 3 characters.');
  }

  const { data, error } = await supabase
    .from('tournaments')
    .update(payload)
    .eq('id', id)
    .select(TOURNAMENT_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: describe(error) };
  if (!data) return fail('That tournament no longer exists.');
  return { data, error: null };
}

export async function deleteTournament(id) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return fail('A tournament id is required.');

  const { error } = await supabase.from('tournaments').delete().eq('id', id);
  if (error) return { data: null, error: describe(error) };
  return { data: { id }, error: null };
}

export async function setTournamentStatus(id, status) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return fail('A tournament id is required.');
  if (!TOURNAMENT_STATUS_VALUES.includes(status)) return fail('Choose a valid tournament status.');

  const { data, error } = await supabase
    .from('tournaments')
    .update({ status })
    .eq('id', id)
    .select(TOURNAMENT_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: describe(error) };
  if (!data) return fail('That tournament no longer exists.');
  return { data, error: null };
}

export async function closeTournament(id) {
  return setTournamentStatus(id, 'cancelled');
}

export async function joinTournament(tournamentId, profileId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!tournamentId) return fail('A tournament id is required.');
  if (!profileId) return fail('A profile is required to join a tournament.');

  const { data, error } = await supabase
    .from('tournament_participants')
    .insert({ tournament_id: tournamentId, user_id: profileId, status: 'registered' })
    .select(PARTICIPANT_COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail('You have already joined this tournament.');
    }
    if (error.code === CHECK_VIOLATION) {
      return fail('A registration must belong to either a player or a team.');
    }
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return fail('That tournament or profile no longer exists.');
    }
    return { data: null, error: describe(error) };
  }

  return { data, error: null };
}

export async function leaveTournament(tournamentId, profileId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!tournamentId) return fail('A tournament id is required.');
  if (!profileId) return fail('A profile is required.');

  // Check if user is the tournament owner
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('organizer_id')
    .eq('id', tournamentId)
    .limit(1)
    .maybeSingle();

  if (tournamentError) return { data: null, error: describe(tournamentError) };
  if (!tournament) return fail('That tournament no longer exists.');

  // Prevent owner from leaving their own tournament
  if (tournament.organizer_id === profileId) {
    return fail("You can't leave a tournament you own. Close or cancel the tournament instead.");
  }

  const { data: existing, error: lookupError } = await supabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', profileId)
    .limit(1);

  if (lookupError) return { data: null, error: describe(lookupError) };
  const registration = (existing ?? [])[0];
  if (!registration) return fail('You are not registered for this tournament.');

  const { error } = await supabase
    .from('tournament_participants')
    .delete()
    .eq('id', registration.id);

  if (error) return { data: null, error: describe(error) };
  return { data: { id: registration.id }, error: null };
}

export async function generateTournamentFixtures(tournamentId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!tournamentId) return fail('A tournament id is required.');

  const { data, error } = await supabase.rpc('generate_fixtures', {
    p_tournament_id: tournamentId,
  });

  if (error) return { data: null, error: describe(error) };
  return { data: { fixtures_created: data ?? 0 }, error: null };
}

export async function generateNextRound(tournamentId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!tournamentId) return fail('A tournament id is required.');

  const { data, error } = await supabase.rpc('generate_next_round', {
    p_tournament_id: tournamentId,
  });

  if (error) return { data: null, error: describe(error) };
  return { data: { fixtures_created: data ?? 0 }, error: null };
}

export async function submitFixtureResult({ fixtureId, homeScore, awayScore, submittedBy, notes }) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!fixtureId) return fail('A fixture id is required.');
  if (homeScore === '' || homeScore === null || homeScore === undefined || !isWholeNumber(homeScore)) {
    return fail('Home score must be a whole number of 0 or more.');
  }
  if (awayScore === '' || awayScore === null || awayScore === undefined || !isWholeNumber(awayScore)) {
    return fail('Away score must be a whole number of 0 or more.');
  }

  const payload = {
    fixture_id: fixtureId,
    home_score: Number(homeScore),
    away_score: Number(awayScore),
    submitted_by: emptyToNull(submittedBy),
    submitted_at: new Date().toISOString(),
    status: 'submitted',
    notes: emptyToNull(notes),
  };

  const { data, error } = await supabase
    .from('fixture_results')
    .upsert(payload, { onConflict: 'fixture_id' })
    .select(RESULT_COLUMNS)
    .limit(1)
    .single();

  if (error) return { data: null, error: describe(error) };
  return { data, error: null };
}

export async function scheduleFixture(fixtureId, scheduledAt) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!fixtureId) return fail('A fixture id is required.');
  if (!scheduledAt || !isValidDate(scheduledAt)) return fail('Choose a valid match date and time.');

  const { data, error } = await supabase
    .from('fixtures')
    .update({ scheduled_at: new Date(scheduledAt).toISOString() })
    .eq('id', fixtureId)
    .select('id, round, match_number, status, scheduled_at')
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: describe(error) };
  if (!data) return fail('That fixture no longer exists.');
  return { data, error: null };
}

export async function deleteFixture(fixtureId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!fixtureId) return fail('A fixture id is required.');

  const { error } = await supabase.from('fixtures').delete().eq('id', fixtureId);
  if (error) return { data: null, error: describe(error) };
  return { data: { id: fixtureId }, error: null };
}
// =============================================================================
// Organizer controls over a tournament's participants (admin control centre)
// =============================================================================

export async function removeParticipant(participantId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!participantId) return fail('A participant id is required.');

  const { data, error } = await supabase
    .from('tournament_participants')
    .delete()
    .eq('id', participantId)
    .select('id')
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return fail('This participant still appears in fixtures. Remove those fixtures first.');
    }
    return { data: null, error: describe(error) };
  }
  if (!data) return fail('That participant no longer exists.');
  return { data, error: null };
}

export async function setParticipantStatus(participantId, status) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!participantId) return fail('A participant id is required.');
  if (!PARTICIPANT_STATUS_VALUES.includes(status)) {
    return fail('Choose a valid participant status.');
  }

  const { data, error } = await supabase
    .from('tournament_participants')
    .update({ status })
    .eq('id', participantId)
    .select(PARTICIPANT_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === CHECK_VIOLATION) {
      return fail('Choose a valid participant status.');
    }
    return { data: null, error: describe(error) };
  }
  if (!data) return fail('That participant no longer exists.');
  return { data, error: null };
}

export async function setParticipantSeed(participantId, seed) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!participantId) return fail('A participant id is required.');

  // A blank seed clears the manual ordering, which is what the fixture
  // generators fall back to (registration order).
  const isClearing = seed === '' || seed === null || seed === undefined;
  if (!isClearing && (!isWholeNumber(seed) || Number(seed) < 1)) {
    return fail('Seed must be a whole number of 1 or more, or left blank to clear it.');
  }

  const { data, error } = await supabase
    .from('tournament_participants')
    .update({ seed: isClearing ? null : Number(seed) })
    .eq('id', participantId)
    .select(PARTICIPANT_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: describe(error) };
  if (!data) return fail('That participant no longer exists.');
  return { data, error: null };
}
