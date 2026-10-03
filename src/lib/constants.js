// Enum definitions that mirror the database constraints. No data here:
// everything displayed comes from the database at query time.

export const GAMES = [
  { value: 'dls', label: 'Dream League Soccer' },
  { value: 'efootball', label: 'eFootball' },
  { value: 'fcmobile', label: 'FC Mobile' },
  { value: 'cod', label: 'Call of Duty' },
];

export const TOURNAMENT_FORMATS = [
  { value: 'league', label: 'Round Robin (League)' },
  { value: 'knockout', label: 'Knockout' },
  { value: 'group_knockout', label: 'Groups + Knockout' },
];

export const TOURNAMENT_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'registration', label: 'Registration Open' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const FIXTURE_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PARTICIPANT_STATUSES = [
  { value: 'registered', label: 'Registered' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'eliminated', label: 'Eliminated' },
];

export const TEAM_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'captain', label: 'Captain' },
  { value: 'member', label: 'Member' },
];

export const RESULT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
];

function toMap(options) {
  return options.reduce((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {});
}

export const GAME_MAP = toMap(GAMES);
export const TOURNAMENT_FORMAT_MAP = toMap(TOURNAMENT_FORMATS);
export const TOURNAMENT_STATUS_MAP = toMap(TOURNAMENT_STATUSES);
export const FIXTURE_STATUS_MAP = toMap(FIXTURE_STATUSES);
export const PARTICIPANT_STATUS_MAP = toMap(PARTICIPANT_STATUSES);
export const TEAM_ROLE_MAP = toMap(TEAM_ROLES);
export const RESULT_STATUS_MAP = toMap(RESULT_STATUSES);

export const GAME_VALUES = GAMES.map((game) => game.value);
export const TOURNAMENT_FORMAT_VALUES = TOURNAMENT_FORMATS.map((format) => format.value);
export const TOURNAMENT_STATUS_VALUES = TOURNAMENT_STATUSES.map((status) => status.value);
export const FIXTURE_STATUS_VALUES = FIXTURE_STATUSES.map((status) => status.value);
export const PARTICIPANT_STATUS_VALUES = PARTICIPANT_STATUSES.map((status) => status.value);
export const TEAM_ROLE_VALUES = TEAM_ROLES.map((role) => role.value);

export const ACTIVE_TOURNAMENT_STATUSES = ['registration', 'ongoing'];

// Which boolean column on public.profiles advertises each game.
export const GAME_PROFILE_FLAGS = {
  dls: 'game_dls',
  efootball: 'game_efootball',
  fcmobile: 'game_fcmobile',
  cod: 'game_cod',
};

export function getGameLabel(value) {
  return GAME_MAP[value]?.label ?? value ?? 'Unknown';
}

export function getTournamentFormatLabel(value) {
  return TOURNAMENT_FORMAT_MAP[value]?.label ?? value ?? 'Unknown';
}

export function getTournamentStatusLabel(value) {
  return TOURNAMENT_STATUS_MAP[value]?.label ?? value ?? 'Unknown';
}

export function getFixtureStatusLabel(value) {
  return FIXTURE_STATUS_MAP[value]?.label ?? value ?? 'Unknown';
}

export function getParticipantStatusLabel(value) {
  return PARTICIPANT_STATUS_MAP[value]?.label ?? value ?? 'Unknown';
}