import { getSupabase, isSupabaseConfigured } from '../supabase';
import { getAuthErrorMessage } from '../../contexts/AuthContext';
import { GAME_VALUES } from '../constants';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const TEAM_COLUMNS = 'id, name, description, game, owner_id, created_at, updated_at';
const MEMBER_COLUMNS = 'id, team_id, user_id, role, joined_at';

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

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export async function createTeam({ name, description, game, ownerProfileId } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const teamName = typeof name === 'string' ? name.trim() : name;
  if (!ownerProfileId) return fail('A profile is required to create a team.');
  if (!teamName || teamName.length < 2) return fail('Team name must be at least 2 characters.');
  if (teamName.length > 50) return fail('Team name must be 50 characters or fewer.');
  if (!GAME_VALUES.includes(game)) return fail('Choose a game for this team.');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ name: teamName, description: emptyToNull(description), game, owner_id: ownerProfileId })
    .select(TEAM_COLUMNS)
    .single();

  if (teamError) {
    if (teamError.code === UNIQUE_VIOLATION) return fail('That team name is already taken.');
    return { data: null, error: describe(teamError) };
  }

  const { data: membership, error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: ownerProfileId, role: 'owner' })
    .select(MEMBER_COLUMNS)
    .single();

  if (memberError) {
    // Roll the team back so a half-created team is never left behind.
    await supabase.from('teams').delete().eq('id', team.id);
    if (memberError.code === UNIQUE_VIOLATION) return fail('You are already a member of this team.');
    if (memberError.code === FOREIGN_KEY_VIOLATION) return fail('That profile no longer exists.');
    return { data: null, error: describe(memberError) };
  }

  return { data: { team, membership }, error: null };
}

export async function updateTeam(id, values) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return fail('A team id is required.');

  const payload = {};
  ['name', 'description', 'game'].forEach((field) => {
    if (values && Object.prototype.hasOwnProperty.call(values, field)) {
      payload[field] = field === 'name' ? (values[field] ?? '').trim() : values[field];
    }
  });

  if (Object.keys(payload).length === 0) return fail('There is nothing to update.');
  if (payload.name !== undefined && (!payload.name || payload.name.length < 2)) {
    return fail('Team name must be at least 2 characters.');
  }
  if (payload.game !== undefined && !GAME_VALUES.includes(payload.game)) {
    return fail('Choose a valid game.');
  }

  const { data, error } = await supabase
    .from('teams')
    .update(payload)
    .eq('id', id)
    .select(TEAM_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail('That team name is already taken.');
    return { data: null, error: describe(error) };
  }
  if (!data) return fail('That team no longer exists.');
  return { data, error: null };
}

export async function deleteTeam(id) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return fail('A team id is required.');

  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) return { data: null, error: describe(error) };
  return { data: { id }, error: null };
}

export async function joinTeam(teamId, profileId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!teamId) return fail('A team id is required.');
  if (!profileId) return fail('A profile is required to join a team.');

  const { data, error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: profileId, role: 'member' })
    .select(MEMBER_COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail('You are already a member of this team.');
    if (error.code === FOREIGN_KEY_VIOLATION) return fail('That team or profile no longer exists.');
    return { data: null, error: describe(error) };
  }

  return { data, error: null };
}

export async function leaveTeam(teamId, profileId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!teamId) return fail('A team id is required.');
  if (!profileId) return fail('A profile is required.');

  const { data: existing, error: lookupError } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('team_id', teamId)
    .eq('user_id', profileId)
    .limit(1);

  if (lookupError) return { data: null, error: describe(lookupError) };
  const membership = (existing ?? [])[0];
  if (!membership) return fail('You are not a member of this team.');
  if (membership.role === 'owner') {
    return fail('Transfer ownership before leaving this team.');
  }

  const { error } = await supabase.from('team_members').delete().eq('id', membership.id);
  if (error) return { data: null, error: describe(error) };
  return { data: { id: membership.id }, error: null };
}