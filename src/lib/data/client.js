import { getSupabase, isSupabaseConfigured } from '../supabase';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const ORGANIZER_SELECT = 'organizer:organizer_id (id, username, display_name, profile_picture)';

const PARTICIPANT_SELECT = [
  'id',
  'user_id',
  'team_id',
  'status',
  'seed',
  'joined_at',
  'user:user_id (id, username, display_name, profile_picture)',
  'team:team_id (id, name, game)',
].join(', ');

const STANDINGS_SELECT = [
  'tournament_id',
  'tournament_name',
  'participant_id',
  'format',
  'status',
  'played',
  'won',
  'drew',
  'lost',
  'goals_for',
  'goals_against',
  'goal_difference',
  'points',
].join(', ');

const STANDINGS_PARTICIPANT_SELECT = [
  'id',
  'user_id',
  'team_id',
  'user:user_id (id, username, display_name, profile_picture)',
  'team:team_id (id, name)',
].join(', ');

const TOURNAMENT_SELECT = [
  'id',
  'organizer_id',
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
  'created_at',
  'updated_at',
  ORGANIZER_SELECT,
].join(', ');

const TOURNAMENT_WITH_ROWS_SELECT = [
  TOURNAMENT_SELECT,
  `participants:tournament_participants (${PARTICIPANT_SELECT})`,
  'fixtures (id, round, match_number, status, scheduled_at, home_participant_id, away_participant_id',
  `home:home_participant_id (${PARTICIPANT_SELECT})`,
  `away:away_participant_id (${PARTICIPANT_SELECT})`,
  'fixture_results (home_score, away_score, status, notes, submitted_at))',
].join(', ');

const RANKING_SELECT = [
  'rank',
  'user_id',
  'tournaments_entered',
  'played',
  'won',
  'drew',
  'lost',
  'goals_for',
  'goals_against',
  'goal_difference',
  'points',
  'win_rate',
].join(', ');

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}

export function participantLabel(participant) {
  if (!participant) return 'TBD';
  if (participant.team?.name) return participant.team.name;
  return participant.user?.display_name || participant.user?.username || 'Unknown';
}

async function resolveProfile(supabase, userId) {
  if (!userId) return { profile: null, error: { message: 'A user id is required.' } };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, username, display_name, profile_picture, bio, game_dls, game_efootball, game_fcmobile, game_cod, created_at')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) return { profile: null, error };
  if (!data) {
    return { profile: null, error: { message: 'No profile is linked to this account yet.' } };
  }
  return { profile: data, error: null };
}

export async function fetchMyProfile(userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, username, display_name, profile_picture, bio, game_dls, game_efootball, game_fcmobile, game_cod, created_at, updated_at')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

export async function fetchDashboard(userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { profile, error: profileError } = await resolveProfile(supabase, userId);
  if (profileError) return { data: null, error: profileError };

  const { data: participants, error: participantsError } = await supabase
    .from('tournament_participants')
    .select('id, tournament_id, status, seed, joined_at')
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false })
    .limit(50);

  if (participantsError) return { data: null, error: participantsError };

  const participantIds = (participants ?? []).map((row) => row.id);

  const [organized, participationsWithTournament, fixtures, rankings] = await Promise.all([
    supabase
      .from('tournaments')
      .select(TOURNAMENT_SELECT)
      .eq('organizer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20),
    participantIds.length
      ? supabase
          .from('tournament_participants')
          .select(`id, tournament_id, status, seed, joined_at, tournament:tournament_id (${TOURNAMENT_SELECT})`)
          .eq('user_id', profile.id)
          .order('joined_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabase
          .from('fixtures')
          .select(
            'id, tournament_id, round, match_number, status, scheduled_at, home_participant_id, away_participant_id, tournament:tournament_id (id, name, game, status), home:home_participant_id (id, user_id, team_id, user:user_id (username, display_name), team:team_id (name)), away:away_participant_id (id, user_id, team_id, user:user_id (username, display_name), team:team_id (name))',
          )
          .eq('status', 'scheduled')
          .or(
            `home_participant_id.in.(${participantIds.join(',')}),away_participant_id.in.(${participantIds.join(',')})`,
          )
          .order('scheduled_at', { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('player_rankings').select(RANKING_SELECT).eq('user_id', profile.user_id).limit(1),
  ]);

  const error =
    organized.error || participationsWithTournament.error || fixtures.error || rankings.error;
  if (error) return { data: null, error };

  return {
    data: {
      profile,
      organizedTournaments: organized.data ?? [],
      participations: participationsWithTournament.data ?? [],
      upcomingFixtures: fixtures.data ?? [],
      ranking: (rankings.data ?? [])[0] ?? null,
    },
    error: null,
  };
}
export async function fetchMyTeams(userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { profile, error: profileError } = await resolveProfile(supabase, userId);
  if (profileError) return { data: null, error: profileError };

  const { data, error } = await supabase
    .from('team_members')
    .select(
      'id, role, joined_at, team:team_id (id, name, description, game, created_at, owner:owner_id (id, username, display_name, profile_picture), team_members (id, role, user_id))',
    )
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false })
    .limit(50);

  if (error) return { data: null, error };

  const teams = (data ?? [])
    .map((membership) => {
      const team = membership.team ?? null;
      if (!team) return null;
      return {
        ...team,
        membership_id: membership.id,
        my_role: membership.role,
        joined_at: membership.joined_at,
        member_count: Array.isArray(team.team_members) ? team.team_members.length : 0,
        members: Array.isArray(team.team_members) ? team.team_members : [],
      };
    })
    .filter(Boolean);

  return { data: teams, error: null };
}

const TEAM_DETAIL_SELECT = [
  'id',
  'name',
  'description',
  'game',
  'owner_id',
  'created_at',
  'updated_at',
  'owner:owner_id (id, username, display_name, profile_picture)',
  'team_members (id, user_id, role, joined_at, profile:user_id (id, username, display_name, profile_picture))',
  'entries:tournament_participants (id, tournament_id, status, seed, joined_at, tournament:tournament_id (id, name, game, status))',
].join(', ');

// Client-side twin of getTeams for the detail screen. The roster comes from
// team_members -> profiles and the tournament entries from
// tournament_participants -> tournaments, so every rendered value is a real row.
export async function fetchTeamById(id) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return { data: null, error: { message: 'A team id is required.' } };

  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_DETAIL_SELECT)
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  const members = (data.team_members ?? [])
    .map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      joined_at: membership.joined_at,
      profile: membership.profile ?? null,
    }))
    .sort((a, b) => String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? '')));

  const entries = (data.entries ?? [])
    .filter((entry) => entry.tournament)
    .sort((a, b) => String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? '')));

  return {
    data: {
      ...data,
      members,
      member_count: members.length,
      entries,
    },
    error: null,
  };
}

export async function fetchTournamentForUser(id, userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return { data: null, error: { message: 'A tournament id is required.' } };

  const { profile, error: profileError } = await resolveProfile(supabase, userId);
  if (profileError) return { data: null, error: profileError };

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_WITH_ROWS_SELECT)

    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!tournament) return { data: null, error: null };

  const participants = tournament.participants ?? [];
  const myParticipant = participants.find((row) => row.user_id === profile.id) ?? null;

  return {
    data: {
      tournament: {
        ...tournament,
        participants,
        participant_count: participants.length,
        fixtures: tournament.fixtures ?? [],
      },
      isOrganizer: tournament.organizer_id === profile.id,
      amRegistered: Boolean(myParticipant),
      myParticipantId: myParticipant?.id ?? null,
    },
    error: null,
  };
}

export async function fetchFixtureDetail(fixtureId, userId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!fixtureId) return { data: null, error: { message: 'A fixture id is required.' } };

  const { profile, error: profileError } = await resolveProfile(supabase, userId);
  if (profileError) return { data: null, error: profileError };

  const { data: fixture, error } = await supabase
    .from('fixtures')
    .select(
      [
        'id',
        'tournament_id',
        'round',
        'match_number',
        'status',
        'scheduled_at',
        'home_participant_id',
        'away_participant_id',
        `tournament:tournament_id (${TOURNAMENT_SELECT})`,
        `home:home_participant_id (${PARTICIPANT_SELECT})`,
        `away:away_participant_id (${PARTICIPANT_SELECT})`,
        'fixture_results (fixture_id, home_score, away_score, status, notes, submitted_at, submitted_by)',
      ].join(', '),
    )
    .eq('id', fixtureId)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!fixture) return { data: null, error: null };

  const home = fixture.home ?? null;
  const away = fixture.away ?? null;
  const isOrganizer = fixture.tournament?.organizer_id === profile.id;
  const isParticipant = home?.user_id === profile.id || away?.user_id === profile.id;

  return {
    data: {
      fixture: {
        ...fixture,
        home,
        away,
        result: (fixture.fixture_results ?? [])[0] ?? null,
      },
      isOrganizer,
      isParticipant,
      canSubmit: Boolean(isOrganizer || isParticipant),
    },
    error: null,
  };
}

// Signed-out visitors still get the public tournament row, so this skips the
// profiles lookup that fetchTournamentForUser needs for isOrganizer/amRegistered.
export async function fetchTournamentPublic(id) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return { data: null, error: { message: 'A tournament id is required.' } };

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_WITH_ROWS_SELECT)
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!tournament) return { data: null, error: null };

  const participants = tournament.participants ?? [];

  return {
    data: {
      tournament: {
        ...tournament,
        participants,
        participant_count: participants.length,
        fixtures: tournament.fixtures ?? [],
      },
      isOrganizer: false,
      amRegistered: false,
      myParticipantId: null,
    },
    error: null,
  };
}

function decorateStanding(row, participant) {
  const user = participant?.user ?? null;
  const team = participant?.team ?? null;
  const isTeam = Boolean(team);
  return {
    ...row,
    is_team: isTeam,
    user_id: participant?.user_id ?? null,
    team_id: participant?.team_id ?? null,
    label: isTeam ? team.name : (user?.display_name || user?.username || 'Unknown'),
    secondary_label: isTeam ? null : (user?.username ?? null),
    avatar: isTeam ? null : (user?.profile_picture ?? null),
  };
}

// Client-side twin of getTournamentStandings so the tournament detail screen can
// read the view without a server round trip. Returns real rows or the real error.
export async function fetchTournamentStandings(tournamentId) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!tournamentId) return { data: null, error: { message: 'A tournament id is required.' } };

  const { data: rows, error } = await supabase
    .from('tournament_standings')
    .select(STANDINGS_SELECT)
    .eq('tournament_id', tournamentId)
    .order('points', { ascending: false })
    .order('goal_difference', { ascending: false })
    .order('goals_for', { ascending: false })
    .limit(500);

  if (error) return { data: null, error };
  if (!rows || rows.length === 0) return { data: [], error: null };

  const participantIds = rows.map((row) => row.participant_id).filter(Boolean);
  const { data: participants, error: participantsError } = await supabase
    .from('tournament_participants')
    .select(STANDINGS_PARTICIPANT_SELECT)
    .in('id', participantIds)
    .limit(participantIds.length);

  if (participantsError) return { data: null, error: participantsError };

  const byId = new Map((participants ?? []).map((participant) => [participant.id, participant]));
  const data = rows.map((row) => decorateStanding(row, byId.get(row.participant_id)));
  return { data, error: null };
}
