import { getSupabaseServer, isSupabaseServerConfigured } from '../supabaseServer';
import {
  ACTIVE_TOURNAMENT_STATUSES,
  GAME_PROFILE_FLAGS,
  GAME_VALUES,
  TOURNAMENT_STATUS_VALUES,
} from '../constants';

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

const GAME_FLAG_FILTER_LIMIT = 2000;
const GOAL_ROWS_LIMIT = 5000;

const ORGANIZER_SELECT = 'organizer:organizer_id (id, username, display_name, profile_picture)';

const TOURNAMENT_COLUMNS = [
  'id',
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
];

const TOURNAMENT_CARD_SELECT = [
  ...TOURNAMENT_COLUMNS,
  ORGANIZER_SELECT,
  'participants:tournament_participants (id)',
  'fixtures (id)',
].join(', ');

const TOURNAMENT_DETAIL_SELECT = [
  ...TOURNAMENT_COLUMNS,
  'updated_at',
  ORGANIZER_SELECT,
  'participants:tournament_participants (id, user_id, team_id, status, seed, joined_at, user:user_id (id, username, display_name, profile_picture), team:team_id (id, name, game))',
  'fixtures (id, tournament_id, round, match_number, status, scheduled_at, home_participant_id, away_participant_id, fixture_results (home_score, away_score, status, notes, submitted_at))',
].join(', ');

const PROFILE_SELECT = [
  'id',
  'user_id',
  'username',
  'display_name',
  'profile_picture',
  'bio',
  'game_dls',
  'game_efootball',
  'game_fcmobile',
  'game_cod',
  'created_at',
].join(', ');

const RANKING_SELECT = [
  'rank',
  'user_id',
  'username',
  'display_name',
  'profile_picture',
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
  if (!isSupabaseServerConfigured()) return null;
  return getSupabaseServer();
}

function withCounts(rows) {
  return (rows ?? []).map((row) => ({
    ...row,
    participant_count: Array.isArray(row.participants) ? row.participants.length : 0,
    fixture_count: Array.isArray(row.fixtures) ? row.fixtures.length : 0,
  }));
}

// player_rankings carries no game column, so stats are merged onto profiles by user_id.
function withRankings(profiles, rankingRows) {
  const byUserId = new Map((rankingRows ?? []).map((row) => [row.user_id, row]));
  return (profiles ?? []).map((profile) => {
    const ranking = byUserId.get(profile.user_id) ?? null;
    return {
      ...profile,
      rank: ranking?.rank ?? null,
      tournaments_entered: ranking?.tournaments_entered ?? 0,
      played: ranking?.played ?? 0,
      won: ranking?.won ?? 0,
      drew: ranking?.drew ?? 0,
      lost: ranking?.lost ?? 0,
      goals_for: ranking?.goals_for ?? 0,
      goals_against: ranking?.goals_against ?? 0,
      goal_difference: ranking?.goal_difference ?? 0,
      points: ranking?.points ?? 0,
      win_rate: ranking?.win_rate ?? 0,
      matches: ranking?.played ?? 0,
    };
  });
}

export async function getPlatformStats() {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const [players, tournaments, active, fixtures, teams] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).limit(1),
    supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .in('status', ACTIVE_TOURNAMENT_STATUSES)
      .limit(1),
    supabase.from('fixtures').select('id', { count: 'exact', head: true }).limit(1),
    supabase.from('teams').select('id', { count: 'exact', head: true }).limit(1),
  ]);

  const error = players.error || tournaments.error || active.error || fixtures.error || teams.error;
  if (error) return { data: null, error };

  return {
    data: {
      totalPlayers: players.count ?? 0,
      totalTournaments: tournaments.count ?? 0,
      activeTournaments: active.count ?? 0,
      totalFixtures: fixtures.count ?? 0,
      totalTeams: teams.count ?? 0,
    },
    error: null,
  };
}

export async function getFeaturedTournaments(limit = 6) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_CARD_SELECT)
    .in('status', ACTIVE_TOURNAMENT_STATUSES)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error };
  return { data: withCounts(data), error: null };
}

function sanitiseSearch(term) {
  return String(term).replace(/[,()%*]/g, ' ').trim();
}

export async function getTournaments({ game, status, search, limit = 20, offset = 0 } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  let query = supabase
    .from('tournaments')
    .select(TOURNAMENT_CARD_SELECT, { count: 'exact' });

  if (game) query = query.eq('game', game);
  if (status) query = query.eq('status', status);

  const term = sanitiseSearch(search ?? '');
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { data: null, error };
  return { data: { rows: withCounts(data), count: count ?? 0 }, error: null };
}

export async function getTournamentById(id) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!id) return { data: null, error: { message: 'A tournament id is required.' } };

  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_DETAIL_SELECT)
    .eq('id', id)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };
  return { data: withCounts(data), error: null };
}
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

export async function getTournamentStandings(tournamentId) {
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

export async function getRankings({ limit = 25, game } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  let allowedUserIds = null;

  if (game) {
    // player_rankings has no game column, so a game filter resolves to the
    // profiles that advertise the game and the view rows are matched to them.
    const flag = GAME_PROFILE_FLAGS[game];
    if (!flag) return { data: null, error: { message: `Unknown game: ${game}` } };

    const { data: players, error: playersError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq(flag, true)
      .limit(GAME_FLAG_FILTER_LIMIT);

    if (playersError) return { data: null, error: playersError };
    allowedUserIds = new Set((players ?? []).map((row) => row.user_id));
  }

  const { data, error } = await supabase
    .from('player_rankings')
    .select(RANKING_SELECT)
    .order('rank', { ascending: true })
    .limit(allowedUserIds ? limit * 3 : limit);

  if (error) return { data: null, error };
  const rows = data ?? [];
  return { data: allowedUserIds ? rows.filter((row) => allowedUserIds.has(row.user_id)).slice(0, limit) : rows, error: null };
}

export async function getPlayers({ limit = 24, offset = 0, search } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  let query = supabase.from('profiles').select(PROFILE_SELECT, { count: 'exact' });

  const term = sanitiseSearch(search ?? '');
  if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);

  const { data: profiles, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { data: null, error };
  if (!profiles || profiles.length === 0) return { data: { rows: [], count: count ?? 0 }, error: null };

  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  const { data: rankings, error: rankingsError } = await supabase
    .from('player_rankings')
    .select(RANKING_SELECT)
    .in('user_id', userIds)
    .limit(userIds.length);

  if (rankingsError) return { data: null, error: rankingsError };
  return { data: { rows: withRankings(profiles, rankings), count: count ?? 0 }, error: null };
}

const TOURNAMENT_STATS_SELECT = [
  'tournament_id',
  'tournament_name',
  'game',
  'tournament_status',
  'played',
  'won',
  'drew',
  'lost',
  'goals_for',
  'goals_against',
  'goal_difference',
  'points',
].join(', ');

export async function getProfileByUsername(username) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };
  if (!username) return { data: null, error: { message: 'A username is required.' } };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('username', username)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!profile) return { data: null, error: null };

  const { data: stats, error: statsError } = await supabase
    .from('player_tournament_stats')
    .select(TOURNAMENT_STATS_SELECT)
    .eq('profile_id', profile.id)
    .order('points', { ascending: false })
    .limit(200);

  if (statsError) return { data: null, error: statsError };

  const { data: rankings, error: rankingsError } = await supabase
    .from('player_rankings')
    .select(RANKING_SELECT)
    .eq('user_id', profile.user_id)
    .limit(1);

  if (rankingsError) return { data: null, error: rankingsError };

  const ranking = (rankings ?? [])[0] ?? null;
  const [merged] = withRankings([profile], rankings);
  return { data: { profile: merged, ranking, stats: stats ?? [] }, error: null };
}

export async function getCommunityProfiles({ limit = 12 } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error };
  if (!profiles || profiles.length === 0) return { data: [], error: null };

  const userIds = profiles.map((profile) => profile.user_id).filter(Boolean);
  const { data: rankings, error: rankingsError } = await supabase
    .from('player_rankings')
    .select(RANKING_SELECT)
    .in('user_id', userIds)
    .limit(userIds.length);

  if (rankingsError) return { data: null, error: rankingsError };
  return { data: withRankings(profiles, rankings), error: null };
}

export async function getGlobalStatistics() {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const statusCounts = await Promise.all(
    TOURNAMENT_STATUS_VALUES.map((status) =>
      supabase
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .limit(1)
    ),
  );

  const gameCounts = await Promise.all(
    GAME_VALUES.map((game) =>
      supabase
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('game', game)
        .limit(1),
    ),
  );

  const [players, allTournaments, playedFixtures, results] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).limit(1),
    supabase
      .from('fixtures')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .limit(1),
    supabase
      .from('fixture_results')
      .select('home_score, away_score')
      .eq('status', 'submitted')
      .limit(GOAL_ROWS_LIMIT),
  ]);

  const error =
    players.error ||
    allTournaments.error ||
    playedFixtures.error ||
    results.error ||
    statusCounts.find((result) => result.error)?.error ||
    gameCounts.find((result) => result.error)?.error;

  if (error) return { data: null, error };

  const tournamentsByStatus = {};
  TOURNAMENT_STATUS_VALUES.forEach((status, index) => {
    tournamentsByStatus[status] = statusCounts[index].count ?? 0;
  });

  const tournamentsByGame = {};
  GAME_VALUES.forEach((game, index) => {
    tournamentsByGame[game] = gameCounts[index].count ?? 0;
  });

  const totalGoals = (results.data ?? []).reduce(
    (sum, row) => sum + (row.home_score ?? 0) + (row.away_score ?? 0),
    0,
  );

  return {
    data: {
      totalPlayers: players.count ?? 0,
      totalTournaments: allTournaments.count ?? 0,
      totalFixturesPlayed: playedFixtures.count ?? 0,
      totalGoals,
      tournamentsByStatus,
      tournamentsByGame,
    },
    error: null,
  };
}

export async function getTeams({ limit = 24 } = {}) {
  const supabase = getClient();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const { data, error } = await supabase
    .from('teams')
    .select(
      'id, name, description, game, owner_id, created_at, owner:owner_id (id, username, display_name, profile_picture), team_members (id, role)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error };

  const rows = (data ?? []).map((team) => ({
    ...team,
    member_count: Array.isArray(team.team_members) ? team.team_members.length : 0,
    members: Array.isArray(team.team_members) ? team.team_members : [],
  }));

  return { data: rows, error: null };
}