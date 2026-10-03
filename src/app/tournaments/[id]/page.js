'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  DataBoundary,
  EmptyState,
  ErrorState,
  FixtureList,
  LoadingState,
  StandingsTable,
  SuccessBanner,
} from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchMyProfile,
  fetchTournamentForUser,
  fetchTournamentPublic,
  fetchTournamentStandings,
  participantLabel,
} from '../../../lib/data/client';
import {
  deleteTournament,
  generateNextRound,
  generateTournamentFixtures,
  joinTournament,
  leaveTournament,
  setTournamentStatus,
  closeTournament,
} from '../../../lib/mutations/tournaments';
import { useRevalidate } from '../../../lib/mutations/revalidate';
import {
  TOURNAMENT_STATUSES,
  getGameLabel,
  getParticipantStatusLabel,
  getTournamentFormatLabel,
  getTournamentStatusLabel,
} from '../../../lib/constants';
import styles from './tournament-detail.module.css';

const KNOCKOUT_FORMATS = ['knockout', 'group_knockout'];
const JOINABLE_STATUSES = ['upcoming', 'registration'];

const STATUS_BADGE_CLASSES = {
  upcoming: styles.badgeUpcoming,
  registration: styles.badgeRegistration,
  ongoing: styles.badgeOngoing,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function groupByRound(fixtures) {
  const groups = [];
  fixtures.forEach((fixture) => {
    const round = fixture.round ?? 0;
    let group = groups.find((entry) => entry.round === round);
    if (!group) {
      group = { round, fixtures: [] };
      groups.push(group);
    }
    group.fixtures.push(fixture);
  });
  groups.sort((a, b) => a.round - b.round);
  return groups;
}

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();
  const revalidate = useRevalidate();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [standings, setStandings] = useState([]);
  const [standingsError, setStandingsError] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(true);

  const [profileId, setProfileId] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');

  const [statusChoice, setStatusChoice] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEffect(() => {
    if (!id || authLoading) return undefined;
    let active = true;
    const request = user ? fetchTournamentForUser(id, user.id) : fetchTournamentPublic(id);

    request.then(({ data, error }) => {
      if (!active) return;
      setPayload(data);
      setLoadError(error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [authLoading, id, user]);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;

    fetchTournamentStandings(id).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStandingsError(error);
        setStandings([]);
      } else {
        setStandings(data ?? []);
        setStandingsError(null);
      }
      setStandingsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    fetchMyProfile(user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setProfileId(null);
        setProfileError(error);
      } else if (!data) {
        setProfileId(null);
        setProfileError({ message: 'No profile is linked to this account yet.' });
      } else {
        setProfileId(data.id);
        setProfileError(null);
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  // Used by retry and after every mutation so the screen shows real DB state.
  const refresh = useCallback(async () => {
    if (!id) return;

    const [tournamentResult, standingsResult] = await Promise.all([
      user ? fetchTournamentForUser(id, user.id) : fetchTournamentPublic(id),
      fetchTournamentStandings(id),
    ]);

    setPayload(tournamentResult.data);
    setLoadError(tournamentResult.error);
    setLoading(false);

    if (standingsResult.error) {
      setStandingsError(standingsResult.error);
      setStandings([]);
    } else {
      setStandings(standingsResult.data ?? []);
      setStandingsError(null);
    }
    setStandingsLoading(false);
  }, [id, user]);

  const runAction = async (key, action) => {
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
    await refresh();
    revalidate();
    return true;
  };

  const handleJoin = async () => {
    const ok = await runAction('join', () => joinTournament(id, profileId));
    if (ok) setSuccess('You are registered for this tournament.');
  };

  const handleLeave = async () => {
    const ok = await runAction('leave', () => leaveTournament(id, profileId));
    if (ok) setSuccess('Your registration was withdrawn.');
  };

  const handleStatus = async () => {
    const ok = await runAction('status', () => setTournamentStatus(id, statusChoice));
    if (ok) setSuccess('Tournament status updated.');
  };

  const handleGenerateFixtures = async () => {
    const ok = await runAction('fixtures', () => generateTournamentFixtures(id));
    if (ok) setSuccess('Fixtures generated from the current registrations.');
  };

  const handleClose = async () => {
    const ok = await runAction('close', () => closeTournament(id));
    if (ok) {
      setSuccess('Tournament has been closed.');
      setConfirmingClose(false);
    }
  };

  const handleNextRound = async () => {
    const ok = await runAction('next-round', () => generateNextRound(id));
    if (ok) setSuccess('The next round was generated from the completed fixtures.');
  };

  const handleDelete = async () => {
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
    router.push('/tournaments');
  };

  const tournament = payload?.tournament ?? null;
  const isOrganizer = Boolean(payload?.isOrganizer);
  const amRegistered = Boolean(payload?.amRegistered);
  const status = tournament?.status ?? '';

  const participants = tournament?.participants ?? [];
  const maxParticipants = tournament?.max_participants ?? null;
  const participantCount = tournament?.participant_count ?? participants.length;
  const isFull = maxParticipants !== null && participantCount >= maxParticipants;
  const canJoin = Boolean(user) && JOINABLE_STATUSES.includes(status) && !amRegistered;
  const canLeave = Boolean(user) && amRegistered && JOINABLE_STATUSES.includes(status);
  const isKnockout = KNOCKOUT_FORMATS.includes(tournament?.format);

  const fixtures = tournament?.fixtures ?? [];
  const roundGroups = groupByRound(fixtures);
  const statusBadge = styles.badge + ' ' + (STATUS_BADGE_CLASSES[status] ?? '');
  const statusValue = statusChoice || status;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href='/tournaments' className={styles.backLink}>
          &larr; All tournaments
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
          {tournament && (
            <>
              <header className={styles.card}>
                <div className={styles.badges}>
                  <span className={styles.badge + ' ' + styles.badgeGame}>
                    {getGameLabel(tournament.game)}
                  </span>
                  <span className={statusBadge}>{getTournamentStatusLabel(status)}</span>
                  <span className={styles.badge}>
                    {getTournamentFormatLabel(tournament.format)}
                  </span>
                </div>

                <h1 className={styles.sectionTitle}>{tournament.name}</h1>

                {tournament.image_url && (
                  <img
                    src={tournament.image_url}
                    alt=''
                    className={styles.cover}
                    aria-hidden='true'
                  />
                )}

                {tournament.description && (
                  <p className={styles.description}>{tournament.description}</p>
                )}

                <div className={styles.facts}>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Organizer</span>
                    <span className={styles.factValue}>
                      {tournament.organizer?.display_name ??
                        tournament.organizer?.username ??
                        'Unknown'}
                    </span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Entry fee</span>
                    <span className={styles.factValue}>
                      {Number(tournament.entry_fee ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Prize pool</span>
                    <span className={styles.factValue}>
                      {Number(tournament.prize_pool ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Participants</span>
                    <span className={styles.factValue}>
                      {participantCount} / {maxParticipants ?? 'Unlimited'}
                    </span>
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
                  <div className={styles.fact}>
                    <span className={styles.factLabel}>Fixtures</span>
                    <span className={styles.factValue}>{fixtures.length}</span>
                  </div>
                </div>

                {tournament.rules && <p className={styles.rules}>{tournament.rules}</p>}
              </header>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Participants ({participantCount})</h2>

                {participants.length === 0 ? (
                  <EmptyState
                    icon='👥'
                    title='Nobody has registered yet'
                    description='Registrations appear here as soon as players join this tournament.'
                  />
                ) : (
                  <ul className={styles.participantList}>
                    {participants.map((participant) => (
                      <li key={participant.id} className={styles.participantRow}>
                        {participant.user?.profile_picture && (
                          <img
                            src={participant.user.profile_picture}
                            alt=''
                            className={styles.avatar}
                            aria-hidden='true'
                          />
                        )}
                        <span className={styles.participantName}>
                          {participantLabel(participant)}
                        </span>
                        <span className={styles.muted}>
                          {getParticipantStatusLabel(participant.status)}
                          {participant.seed !== null && participant.seed !== undefined
                            ? ' - Seed ' + participant.seed
                            : ''}
                        </span>
                        {participant.id === payload.myParticipantId && (
                          <span className={styles.youBadge}>You</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.joinBar}>
                  {!user ? (
                    <span className={styles.muted}>
                      <Link href='/login' className={styles.backLink}>
                        Sign in
                      </Link>{' '}
                      to register for this tournament.
                    </span>
                  ) : canJoin ? (
                    <>
                      <button
                        className={styles.primaryBtn}
                        type='button'
                        onClick={handleJoin}
                        disabled={pendingAction !== '' || isFull || !profileId}
                      >
                        {pendingAction === 'join' ? 'Joining...' : 'Join tournament'}
                      </button>
                      {isFull && (
                        <span className={styles.muted}>
                          This tournament has reached its participant limit.
                        </span>
                      )}
                      {!isFull && profileError && (
                        <span className={styles.muted}>{profileError.message}</span>
                      )}
                    </>
                  ) : canLeave ? (
                    <>
                      {!isOrganizer && (
                        <button
                          className={styles.secondaryBtn}
                          type='button'
                          onClick={handleLeave}
                          disabled={pendingAction !== '' || !profileId}
                        >
                          {pendingAction === 'leave' ? 'Leaving...' : 'Leave tournament'}
                        </button>
                      )}
                      {isOrganizer && (
                        <>
                          {confirmingClose ? (
                            <>
                              <button
                                className={styles.dangerBtn}
                                type='button'
                                onClick={handleClose}
                                disabled={pendingAction !== ''}
                              >
                                {pendingAction === 'close' ? 'Closing...' : 'Confirm close'}
                              </button>
                              <button
                                className={styles.secondaryBtn}
                                type='button'
                                onClick={() => setConfirmingClose(false)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className={styles.dangerBtn}
                              type='button'
                              onClick={() => setConfirmingClose(true)}
                              disabled={pendingAction !== ''}
                            >
                              Close tournament
                            </button>
                          )}
                        </>
                      )}
                    </>
                  ) : amRegistered ? (
                    <span className={styles.muted}>
                      You are registered. Registration changes are closed for this status.
                    </span>
                  ) : (
                    <span className={styles.muted}>
                      Registration is closed for this tournament status.
                    </span>
                  )}
                </div>

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
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Fixtures</h2>

                {fixtures.length === 0 ? (
                  <EmptyState
                    icon='📅'
                    title='No fixtures yet'
                    description='Fixtures appear once the organizer generates them from the registered participants.'
                  />
                ) : (
                  roundGroups.map((group) => (
                    <div key={group.round} className={styles.roundGroup}>
                      <h3 className={styles.roundTitle}>Round {group.round}</h3>
                      <FixtureList
                        fixtures={group.fixtures.map((fixture) => {
                          const result = (fixture.fixture_results ?? [])[0] ?? null;
                          return {
                            id: fixture.id,
                            round: fixture.round,
                            match_number: fixture.match_number,
                            status: fixture.status,
                            scheduled_at: fixture.scheduled_at,
                            hasResult: Boolean(result),
                            home: {
                              label: participantLabel(fixture.home),
                              score: result ? toScore(result.home_score) : null,
                            },
                            away: {
                              label: participantLabel(fixture.away),
                              score: result ? toScore(result.away_score) : null,
                            },
                          };
                        })}
                      />
                      <ul className={styles.matchLinks}>
                        {group.fixtures.map((fixture) => (
                          <li key={fixture.id}>
                            <Link
                              href={'/tournaments/' + id + '/fixtures/' + fixture.id}
                              className={styles.matchLink}
                            >
                              Match {fixture.match_number ?? fixture.round} details
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Standings</h2>

                {standingsLoading ? (
                  <LoadingState label='Loading standings...' />
                ) : standingsError ? (
                  <ErrorState error={standingsError} />
                ) : standings.length === 0 ? (
                  <EmptyState
                    icon='📊'
                    title='No results submitted yet'
                    description='The standings table fills in once fixture results are submitted and the tournament_standings view has rows for this tournament.'
                  />
                ) : (
                  <StandingsTable rows={standings} />
                )}
              </section>

              {isOrganizer && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Organizer actions</h2>
                  <div className={styles.controls}>
                    <div className={styles.control}>
                      <label className={styles.controlLabel} htmlFor='status'>
                        Status
                      </label>
                      <select
                        className={styles.select}
                        id='status'
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
                      disabled={pendingAction !== '' || statusValue === status}
                    >
                      {pendingAction === 'status' ? 'Saving...' : 'Update status'}
                    </button>

                    <button
                      className={styles.secondaryBtn}
                      type='button'
                      onClick={handleGenerateFixtures}
                      disabled={pendingAction !== ''}
                    >
                      {pendingAction === 'fixtures' ? 'Generating...' : 'Generate fixtures'}
                    </button>

                    {isKnockout && (
                      <button
                        className={styles.secondaryBtn}
                        type='button'
                        onClick={handleNextRound}
                        disabled={pendingAction !== ''}
                      >
                        {pendingAction === 'next-round'
                          ? 'Generating...'
                          : 'Generate next round'}
                      </button>
                    )}

                    <Link href={'/tournaments/' + id + '/edit'} className={styles.linkBtn}>
                      Edit tournament
                    </Link>

                    {confirmingDelete ? (
                      <>
                        <button
                          className={styles.dangerBtn}
                          type='button'
                          onClick={handleDelete}
                          disabled={pendingAction !== ''}
                        >
                          {pendingAction === 'delete' ? 'Deleting...' : 'Confirm delete'}
                        </button>
                        <button
                          className={styles.secondaryBtn}
                          type='button'
                          onClick={() => setConfirmingDelete(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.dangerBtn}
                        type='button'
                        onClick={() => setConfirmingDelete(true)}
                        disabled={pendingAction !== ''}
                      >
                        Delete tournament
                      </button>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </DataBoundary>
      </div>
    </div>
  );
}
