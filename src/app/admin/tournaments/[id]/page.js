'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  DataBoundary,
  EmptyState,
  ErrorState,
  SuccessBanner,
} from '../../../../components/ui';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyProfile,
  fetchTournamentForUser,
  participantLabel,
} from '../../../../lib/data/client';
import {
  deleteFixture,
  deleteTournament,
  generateNextRound,
  generateTournamentFixtures,
  removeParticipant,
  scheduleFixture,
  setParticipantSeed,
  setParticipantStatus,
  setTournamentStatus,
  submitFixtureResult,
} from '../../../../lib/mutations/tournaments';
import { useRevalidate } from '../../../../lib/mutations/revalidate';
import {
  PARTICIPANT_STATUSES,
  TOURNAMENT_STATUSES,
  getGameLabel,
  getParticipantStatusLabel,
  getTournamentFormatLabel,
  getTournamentStatusLabel,
} from '../../../../lib/constants';
import styles from './admin-tournament.module.css';

const KNOCKOUT_FORMATS = ['knockout', 'group_knockout'];

const STATUS_BADGE_CLASSES = {
  upcoming: styles.badgeUpcoming,
  registration: styles.badgeRegistration,
  ongoing: styles.badgeOngoing,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
};

const PARTICIPANT_BADGE_CLASSES = {
  registered: styles.badgeOngoing,
  withdrawn: styles.badgeUpcoming,
  eliminated: styles.badgeCancelled,
};
function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// datetime-local needs a local "YYYY-MM-DDTHH:mm" string, not an ISO instant.
function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}

function buildScoreDrafts(fixtures) {
  return fixtures.reduce((drafts, fixture) => {
    const result = (fixture.fixture_results ?? [])[0] ?? null;
    drafts[fixture.id] = {
      home:
        result && result.home_score !== null && result.home_score !== undefined
          ? String(result.home_score)
          : '',
      away:
        result && result.away_score !== null && result.away_score !== undefined
          ? String(result.away_score)
          : '',
      notes: result?.notes ?? '',
    };
    return drafts;
  }, {});
}

function buildScheduleDrafts(fixtures) {
  return fixtures.reduce((drafts, fixture) => {
    drafts[fixture.id] = toDateTimeInput(fixture.scheduled_at);
    return drafts;
  }, {});
}

function buildSeedDrafts(participants) {
  return participants.reduce((drafts, participant) => {
    drafts[participant.id] =
      participant.seed === null || participant.seed === undefined ? '' : String(participant.seed);
    return drafts;
  }, {});
}

function sortBySeed(participants) {
  return [...participants].sort((a, b) => {
    const left = a.seed ?? Number.MAX_SAFE_INTEGER;
    const right = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return String(a.joined_at ?? '').localeCompare(String(b.joined_at ?? ''));
  });
}
export default function AdminTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();
  const revalidate = useRevalidate();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profileId, setProfileId] = useState(null);

  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');

  const [statusChoice, setStatusChoice] = useState('');
  const [seedDrafts, setSeedDrafts] = useState({});
  const [removingId, setRemovingId] = useState('');
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [scheduleDrafts, setScheduleDrafts] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const applyPayload = useCallback((data) => {
    setPayload(data);
    setLoadError(null);
    setLoading(false);
    const fixtures = data?.tournament?.fixtures ?? [];
    setScoreDrafts(buildScoreDrafts(fixtures));
    setScheduleDrafts(buildScheduleDrafts(fixtures));
    setSeedDrafts(buildSeedDrafts(data?.tournament?.participants ?? []));
  }, []);

  const refresh = useCallback(async () => {
    if (!id || !user) return;
    const { data, error } = await fetchTournamentForUser(id, user.id);
    applyPayload(data);
    if (error) setLoadError(error);
  }, [applyPayload, id, user]);

  useEffect(() => {
    if (authLoading || !user || !id) return undefined;
    let active = true;

    fetchTournamentForUser(id, user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLoadError(error);
        setLoading(false);
        return;
      }
      applyPayload(data);
    });

    return () => {
      active = false;
    };
  }, [applyPayload, authLoading, id, user]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    fetchMyProfile(user.id).then(({ data, error }) => {
      if (!active) return;
      setProfileId(error || !data ? null : data.id);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const runAction = async (key, action, successMessage) => {
    setPendingAction(key);
    setActionError(null);
    setSuccess('');

    const { error } = await action();

    if (error) {
      setActionError(error);
      setPendingAction('');
      return false;
    }

    setPendingAction('');
    setSuccess(successMessage);
    await refresh();
    revalidate();
    return true;
  };

  const handleStatus = () =>
    runAction('status', () => setTournamentStatus(id, statusChoice), 'Tournament status updated.');

  const handleGenerateFixtures = () =>
    runAction(
      'fixtures',
      () => generateTournamentFixtures(id),
      'Fixtures generated from the current registrations.'
    );

  const handleNextRound = () =>
    runAction(
      'next-round',
      () => generateNextRound(id),
      'The next round was generated from the completed fixtures.'
    );

  const handleParticipantStatus = (participant, status) => {
    if (status === participant.status) return Promise.resolve(false);
    const label = participantLabel(participant);
    return runAction(
      'participant-status:' + participant.id,
      () => setParticipantStatus(participant.id, status),
      getParticipantStatusLabel(status) + ' applied to ' + label + '.'
    );
  };

  const handleSeed = (participant) => {
    const draft = seedDrafts[participant.id] ?? '';
    const current =
      participant.seed === null || participant.seed === undefined ? '' : String(participant.seed);
    if (draft === current) return Promise.resolve(false);
    const label = participantLabel(participant);
    return runAction(
      'seed:' + participant.id,
      () => setParticipantSeed(participant.id, draft),
      draft === '' ? 'Seed cleared for ' + label + '.' : 'Seed saved for ' + label + '.'
    );
  };

  const handleRemoveParticipant = async (participant) => {
    const label = participantLabel(participant);
    const ok = await runAction(
      'remove:' + participant.id,
      () => removeParticipant(participant.id),
      label + ' was removed from this tournament.'
    );
    setRemovingId('');
    return ok;
  };

  const handleSchedule = (fixture) => {
    const draft = scheduleDrafts[fixture.id] ?? '';
    if (!draft) {
      setActionError({ message: 'Choose a match date and time first.' });
      setPendingAction('');
      return Promise.resolve(false);
    }
    return runAction(
      'schedule:' + fixture.id,
      () => scheduleFixture(fixture.id, draft),
      'Match ' + (fixture.match_number ?? fixture.round) + ' rescheduled.'
    );
  };

  const handleSubmitResult = (fixture) => {
    const draft = scoreDrafts[fixture.id] ?? { home: '', away: '', notes: '' };
    return runAction(
      'result:' + fixture.id,
      () =>
        submitFixtureResult({
          fixtureId: fixture.id,
          homeScore: draft.home,
          awayScore: draft.away,
          submittedBy: profileId,
          notes: draft.notes,
        }),
      'Result saved for match ' + (fixture.match_number ?? fixture.round) + '.'
    );
  };

  const handleCancelFixture = (fixture) =>
    runAction(
      'delete:' + fixture.id,
      () => deleteFixture(fixture.id),
      'Match ' + (fixture.match_number ?? fixture.round) + ' was removed.'
    );

  const handleDeleteTournament = async () => {
    setPendingAction('delete');
    setActionError(null);
    setSuccess('');

    const { error } = await deleteTournament(id);

    if (error) {
      setActionError(error);
      setPendingAction('');
      return;
    }

    setPendingAction('');
    revalidate();
    router.push('/admin/tournaments');
  };
  const tournament = payload?.tournament ?? null;
  const isOrganizer = Boolean(payload?.isOrganizer);

  if (!authLoading && !user) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <EmptyState
              icon='🔐'
              title='Sign in to open the control centre'
              description='Organizer controls are only available to the account that owns the tournament.'
              action={
                <Link href='/login' className={styles.linkBtn}>
                  Go to sign in
                </Link>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  const participants = tournament?.participants ?? [];
  const fixtures = tournament?.fixtures ?? [];
  const status = tournament?.status ?? '';
  const statusValue = statusChoice || status;
  const isKnockout = KNOCKOUT_FORMATS.includes(tournament?.format);
  const activeEntries = participants.filter((entry) => entry.status !== 'withdrawn').length;
  const busy = pendingAction !== '';

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <Link href='/admin/tournaments' className={styles.backLink}>
            &larr; All organized tournaments
          </Link>

          <DataBoundary
            loading={loading || authLoading}
            error={loadError}
            isEmpty={!loading && !loadError && !tournament}
            onRetry={refresh}
            empty={
              <EmptyState
                icon='🏆'
                title='Tournament not found'
                description='This tournament does not exist or it has been removed.'
              />
            }
          >
            {!isOrganizer ? (
              <EmptyState
                icon='🚫'
                title='You are not the organizer of this tournament'
                description='The control centre is limited to the organizer of record for this competition.'
                action={
                  <Link href={'/tournaments/' + id} className={styles.linkBtn}>
                    View the public page instead
                  </Link>
                }
              />
            ) : (
              <>
                {success && (
                  <div className={styles.notice}>
                    <SuccessBanner message={success} />
                  </div>
                )}

                {actionError && (
                  <div className={styles.notice}>
                    <ErrorState error={actionError} />
                  </div>
                )}

                <section className={styles.section}>
                  <div className={styles.badges}>
                    <span className={styles.badge + ' ' + styles.badgeGame}>
                      {getGameLabel(tournament.game)}
                    </span>
                    <span className={styles.badge + ' ' + (STATUS_BADGE_CLASSES[status] ?? '')}>
                      {getTournamentStatusLabel(status)}
                    </span>
                    <span className={styles.badge}>
                      {getTournamentFormatLabel(tournament.format)}
                    </span>
                  </div>

                  <h1 className={styles.sectionTitle}>{tournament.name}</h1>
                  <div className={styles.facts}>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Registrations</span>
                      <span className={styles.factValue}>
                        {tournament.participant_count ?? participants.length} /{' '}
                        {tournament.max_participants ?? 'Unlimited'}
                      </span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Still in</span>
                      <span className={styles.factValue}>{activeEntries}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Fixtures</span>
                      <span className={styles.factValue}>{fixtures.length}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Start date</span>
                      <span className={styles.factValue}>{formatDate(tournament.start_date)}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>End date</span>
                      <span className={styles.factValue}>{formatDate(tournament.end_date)}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Registration deadline</span>
                      <span className={styles.factValue}>
                        {formatDate(tournament.registration_deadline)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.controls}>
                    <div className={styles.control}>
                      <label className={styles.controlLabel} htmlFor='admin-tournament-status'>
                        Tournament status
                      </label>
                      <select
                        className={styles.select}
                        id='admin-tournament-status'
                        value={statusValue}
                        onChange={(event) => setStatusChoice(event.target.value)}
                      >
                        {TOURNAMENT_STATUSES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      className={styles.primaryBtn}
                      type='button'
                      onClick={handleStatus}
                      disabled={busy || statusValue === status}
                    >
                      {pendingAction === 'status' ? 'Saving...' : 'Update status'}
                    </button>

                    <button
                      className={styles.secondaryBtn}
                      type='button'
                      onClick={handleGenerateFixtures}
                      disabled={busy}
                    >
                      {pendingAction === 'fixtures' ? 'Generating...' : 'Generate fixtures'}
                    </button>

                    {isKnockout && (
                      <button
                        className={styles.secondaryBtn}
                        type='button'
                        onClick={handleNextRound}
                        disabled={busy}
                      >
                        {pendingAction === 'next-round' ? 'Generating...' : 'Generate next round'}
                      </button>
                    )}

                    <Link href={'/tournaments/' + id + '/edit'} className={styles.linkBtn}>
                      Edit details
                    </Link>

                    <Link href={'/tournaments/' + id} className={styles.linkBtn}>
                      Public page
                    </Link>
                  </div>

                  <p className={styles.hint}>
                    Seed participants below before generating a bracket: seeded entries are paired
                    first, unseeded entries fall back to registration order.
                  </p>
                </section>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Participants ({participants.length})</h2>

                  {participants.length === 0 ? (
                    <EmptyState
                      icon='👥'
                      title='Nobody has registered yet'
                      description='Registrations appear here as soon as players join this tournament.'
                    />
                  ) : (
                    <ul className={styles.entryList}>
                      {sortBySeed(participants).map((participant) => {
                        const label = participantLabel(participant);
                        const badgeClass =
                          styles.badge +
                          ' ' +
                          (PARTICIPANT_BADGE_CLASSES[participant.status] ?? '');
                        const seedValue = seedDrafts[participant.id] ?? '';
                        const currentSeed =
                          participant.seed === null || participant.seed === undefined
                            ? ''
                            : String(participant.seed);
                        const seedDirty = seedValue !== currentSeed;

                        return (
                          <li key={participant.id} className={styles.entryRow}>
                            <div className={styles.entryIdentity}>
                              {participant.user?.profile_picture && (
                                <img
                                  src={participant.user.profile_picture}
                                  alt=''
                                  className={styles.avatar}
                                  aria-hidden='true'
                                />
                              )}
                              <div className={styles.entryText}>
                                <span className={styles.entryName}>{label}</span>
                                <span className={styles.muted}>
                                  Joined {formatDate(participant.joined_at)}
                                  {participant.team?.name ? ' as ' + participant.team.name : ''}
                                </span>
                              </div>
                            </div>
                            <div className={styles.entryControls}>
                              <span className={badgeClass}>
                                {getParticipantStatusLabel(participant.status)}
                              </span>

                              <select
                                className={styles.select + ' ' + styles.compactSelect}
                                aria-label={'Registration status for ' + label}
                                value={participant.status}
                                onChange={(event) =>
                                  handleParticipantStatus(participant, event.target.value)
                                }
                                disabled={busy}
                              >
                                {PARTICIPANT_STATUSES.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>

                              <input
                                className={styles.input + ' ' + styles.seedInput}
                                type='number'
                                min='1'
                                step='1'
                                inputMode='numeric'
                                placeholder='Seed'
                                aria-label={'Seed for ' + label}
                                value={seedValue}
                                onChange={(event) =>
                                  setSeedDrafts((current) => ({
                                    ...current,
                                    [participant.id]: event.target.value,
                                  }))
                                }
                              />

                              <button
                                className={styles.secondaryBtn}
                                type='button'
                                onClick={() => handleSeed(participant)}
                                disabled={busy || !seedDirty}
                              >
                                {pendingAction === 'seed:' + participant.id
                                  ? 'Saving...'
                                  : 'Save seed'}
                              </button>

                              {removingId === participant.id ? (
                                <>
                                  <button
                                    className={styles.dangerBtn}
                                    type='button'
                                    onClick={() => handleRemoveParticipant(participant)}
                                    disabled={busy}
                                  >
                                    {pendingAction === 'remove:' + participant.id
                                      ? 'Removing...'
                                      : 'Confirm remove'}
                                  </button>
                                  <button
                                    className={styles.secondaryBtn}
                                    type='button'
                                    onClick={() => setRemovingId('')}
                                    disabled={busy}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  className={styles.dangerBtn}
                                  type='button'
                                  onClick={() => setRemovingId(participant.id)}
                                  disabled={busy}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    Fixtures and results ({fixtures.length})
                  </h2>

                  {fixtures.length === 0 ? (
                    <EmptyState
                      icon='📅'
                      title='No fixtures yet'
                      description='Generate fixtures from the current registrations, then schedule and score each match here.'
                    />
                  ) : (
                    <ul className={styles.entryList}>
                      {fixtures.map((fixture) => {
                        const matchNumber = fixture.match_number ?? fixture.round;
                        const draft = scoreDrafts[fixture.id] ?? {
                          home: '',
                          away: '',
                          notes: '',
                        };
                        const scheduleValue = scheduleDrafts[fixture.id] ?? '';
                        const scheduleDirty =
                          scheduleValue !== toDateTimeInput(fixture.scheduled_at);

                        return (
                          <li key={fixture.id} className={styles.entryRow}>
                            <div className={styles.entryIdentity}>
                              <div className={styles.entryText}>
                                <span className={styles.entryName}>
                                  Round {fixture.round} - Match {matchNumber}
                                </span>
                                <span className={styles.muted}>
                                  {participantLabel(fixture.home)} vs {participantLabel(fixture.away)}
                                  {' · '}
                                  {formatDateTime(fixture.scheduled_at)}
                                </span>
                              </div>
                            </div>
                            <div className={styles.entryControls}>
                              <span className={styles.badge}>{String(fixture.status)}</span>

                              <input
                                className={styles.input + ' ' + styles.scoreInput}
                                type='number'
                                min='0'
                                step='1'
                                inputMode='numeric'
                                placeholder='Home'
                                aria-label={'Home score for match ' + matchNumber}
                                value={draft.home}
                                onChange={(event) =>
                                  setScoreDrafts((current) => ({
                                    ...current,
                                    [fixture.id]: { ...draft, home: event.target.value },
                                  }))
                                }
                              />

                              <input
                                className={styles.input + ' ' + styles.scoreInput}
                                type='number'
                                min='0'
                                step='1'
                                inputMode='numeric'
                                placeholder='Away'
                                aria-label={'Away score for match ' + matchNumber}
                                value={draft.away}
                                onChange={(event) =>
                                  setScoreDrafts((current) => ({
                                    ...current,
                                    [fixture.id]: { ...draft, away: event.target.value },
                                  }))
                                }
                              />

                              <button
                                className={styles.primaryBtn}
                                type='button'
                                onClick={() => handleSubmitResult(fixture)}
                                disabled={busy || draft.home === '' || draft.away === ''}
                              >
                                {pendingAction === 'result:' + fixture.id
                                  ? 'Saving...'
                                  : 'Save result'}
                              </button>

                              <input
                                className={styles.input + ' ' + styles.scheduleInput}
                                type='datetime-local'
                                aria-label={'Kick-off time for match ' + matchNumber}
                                value={scheduleValue}
                                onChange={(event) =>
                                  setScheduleDrafts((current) => ({
                                    ...current,
                                    [fixture.id]: event.target.value,
                                  }))
                                }
                              />

                              <button
                                className={styles.secondaryBtn}
                                type='button'
                                onClick={() => handleSchedule(fixture)}
                                disabled={busy || !scheduleDirty}
                              >
                                {pendingAction === 'schedule:' + fixture.id
                                  ? 'Saving...'
                                  : 'Save kick-off'}
                              </button>

                              <Link
                                href={'/tournaments/' + id + '/fixtures/' + fixture.id}
                                className={styles.linkBtn}
                              >
                                Details
                              </Link>

                              <button
                                className={styles.dangerBtn}
                                type='button'
                                onClick={() => handleCancelFixture(fixture)}
                                disabled={busy}
                              >
                                {pendingAction === 'delete:' + fixture.id
                                  ? 'Removing...'
                                  : 'Remove match'}
                              </button>
                            </div>

                            <input
                              className={styles.input + ' ' + styles.notesInput}
                              type='text'
                              placeholder='Result notes (optional)'
                              aria-label={'Notes for match ' + matchNumber}
                              value={draft.notes}
                              onChange={(event) =>
                                setScoreDrafts((current) => ({
                                  ...current,
                                  [fixture.id]: { ...draft, notes: event.target.value },
                                }))
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <section className={styles.section + ' ' + styles.dangerZone}>
                  <h2 className={styles.sectionTitle}>Danger zone</h2>
                  <p className={styles.hint}>
                    Deleting this tournament removes its registrations and every fixture in the
                    cascade. This cannot be undone.
                  </p>

                  {confirmingDelete ? (
                    <div className={styles.controls}>
                      <button
                        className={styles.dangerBtn}
                        type='button'
                        onClick={handleDeleteTournament}
                        disabled={busy}
                      >
                        {pendingAction === 'delete' ? 'Deleting...' : 'Confirm delete'}
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type='button'
                        onClick={() => setConfirmingDelete(false)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.dangerBtn}
                      type='button'
                      onClick={() => setConfirmingDelete(true)}
                      disabled={busy}
                    >
                      Delete tournament
                    </button>
                  )}
                </section>
              </>
            )}
          </DataBoundary>
        </div>
      </main>
    </div>
  );
}
