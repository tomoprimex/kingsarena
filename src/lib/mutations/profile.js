import { getSupabase, isSupabaseConfigured } from '../supabase';
import { getAuthErrorMessage } from '../../contexts/AuthContext';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const UNIQUE_VIOLATION = '23505';

const PROFILE_COLUMNS =
  'id, user_id, username, display_name, profile_picture, bio, game_dls, game_efootball, game_fcmobile, game_cod, created_at, updated_at';

const BOOLEAN_FIELDS = ['game_dls', 'game_efootball', 'game_fcmobile', 'game_cod'];
const UPDATABLE_PROFILE_FIELDS = ['display_name', 'username', 'bio', 'profile_picture', ...BOOLEAN_FIELDS];

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

export async function updateProfile(profileId, values) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!profileId) return fail('A profile id is required.');

  const payload = {};
  UPDATABLE_PROFILE_FIELDS.forEach((field) => {
    if (values && Object.prototype.hasOwnProperty.call(values, field)) {
      payload[field] = field === 'bio' ? emptyToNull(values[field]) : values[field];
    }
  });

  if (Object.keys(payload).length === 0) return fail('There is nothing to update.');

  if (payload.username !== undefined) {
    const username = typeof payload.username === 'string' ? payload.username.trim() : '';
    if (username.length < 3 || username.length > 20) {
      return fail('Username must be between 3 and 20 characters.');
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return fail('Username can only contain letters, numbers, dots, dashes and underscores.');
    }
    payload.username = username;
  }

  if (payload.display_name !== undefined) {
    const displayName =
      typeof payload.display_name === 'string' ? payload.display_name.trim() : '';
    if (displayName.length < 1 || displayName.length > 30) {
      return fail('Display name must be between 1 and 30 characters.');
    }
    payload.display_name = displayName;
  }

  if (payload.bio != null && String(payload.bio).length > 300) {
    return fail('Bio must be 300 characters or fewer.');
  }

  if (payload.profile_picture != null && !isValidUrl(payload.profile_picture)) {
    return fail('Profile picture must be a valid http(s) URL.');
  }

  BOOLEAN_FIELDS.forEach((field) => {
    if (payload[field] !== undefined && typeof payload[field] !== 'boolean') {
      payload[field] = payload[field] === true || payload[field] === 'true';
    }
  });

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select(PROFILE_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail('That username is already taken.');
    return { data: null, error: describe(error) };
  }
  if (!data) return fail('That profile no longer exists.');
  return { data, error: null };
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function changePassword({ currentPassword, newPassword } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  if (!currentPassword) return fail('Enter your current password.');
  if (!newPassword) return fail('Enter a new password.');
  if (String(newPassword).length < 8) return fail('Password must be at least 8 characters.');
  if (currentPassword === newPassword) return fail('The new password must be different.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData?.user?.email;
  if (userError || !email) {
    return {
      data: null,
      error: userError ? describe(userError) : { message: 'You must be signed in to change your password.' },
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) {
    return { data: null, error: describe(signInError) };
  }

  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { data: null, error: describe(error) };
  return { data, error: null };
}