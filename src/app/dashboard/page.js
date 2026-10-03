'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DataBoundary, EmptyState, SuccessBanner } from '../../components/ui';
import { useRequireAuth } from '../../contexts/AuthContext';
import { fetchDashboard, participantLabel } from '../../lib/data/client';
import { useRevalidate } from '../../lib/mutations/revalidate';
import { leaveTournament } from '../../lib/mutations/tournaments';
import {
  getGameLabel,
  getParticipantStatusLabel,
  getTournamentStatusLabel,
} from '../../lib/constants';
import styles from './dashboard.module.css';

const STATUS_BADGE_CLASSES = {
  upcoming: styles.badgeUpcoming,
  registration: styles.badgeRegistration,
  ongoing: styles.badgeOngoing,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
};

const CLOSING_STATUSES = ['upcoming', 'registration'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

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

function formatWinRate(value) {
  if (value === null || value === undefined || value === '') return '0%';
  if (typeof value === 'string') return value;
  const parsed = toNumber(value);
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return Math.round(percent) + '%';
}

function statusBadgeClass(status) {
  return (styles.badge + ' ' + (STATUS_BADGE_CLASSES[status] ?? '')).trim();
}

export default function DashboardPage() {
  const { user, loading: authLoading, configError } = useRequireAuth();
  const revalidate = useRevalidate();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [leavingId, setLeavingId] = useState('');
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (authLoading || !user) return undefined;

    let active = true;

    fetchDashboard(user.id).then(({ data, error }) => {
      if (!active) return;
      setPayload(data);
      setLoadError(error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await fetchDashboard(user.id);
    setPayload(data);
    setLoadError(error);
    setLoading(false);
  }, [user]);

  const handleLeave = async (tournamentId) => {
    if (!payload?.profile || leavingId) return;

    setLeavingId(tournamentId);
    setActionError(null);
    setSuccess('');

    const { error } = await leaveTournament(tournamentId, payload.profile.id);

    if (error) {
      setActionError(error);
      setLeavingId('');
      return;
    }

    setLeavingId('');
    await refresh();
    revalidate();
    setSuccess('Your registration was withdrawn.');
  };

  if (authLoading) {
    return <main className={styles.main} />;
  }

  if (configError || !user) {
    return null;
  }

  const profile = payload?.profile ?? null;
  const displayName = profile?.display_name || profile?.username || user.email || 'Player';
  const ranking = payload?.ranking ?? null;
  const organizedTournaments = payload?.organizedTournaments ?? [];
  const participations = payload?.participations ?? [];
  const upcomingFixtures = payload?.upcomingFixtures ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>Welcome back, {displayName}!</h1>
          <p className={styles.welcomeSubtitle}>
            Everything below is read straight from the Kings Arena database.
          </p>
        </div>

        {success && (
          <div className={styles.notice}>
            <SuccessBanner message={success} />
          </div>
        )}

        {actionError && (
          <div className={styles.notice}>
            <p className={styles.actionError}>{actionError.message}</p>
          </div>
        )}

        <DataBoundary
          loading={loading}
          error={loadError}
          isEmpty={!loading && !loadError && !payload}
          onRetry={refresh}
          empty={
            <EmptyState
              icon='&#128100;'
              title='No dashboard data'
              description='There is no player profile linked to this account yet.'
            />
          }
        >
          {payload && (
            <div className={styles.dashboardGrid}>
              <section className={styles.statsOverview}>
                <h2 className={styles.sectionTitle}>Your Stats</h2>
                <div className={styles.statsCards}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>
                      {toNumber(ranking?.tournaments_entered)}
                    </span>
                    <span className={styles.statLabel}>Entered</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.played)}</span>
                    <span className={styles.statLabel}>Played</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.won)}</span>
                    <span className={styles.statLabel}>Won</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>
                      {formatWinRate(ranking?.win_rate)}
                    </span>
                    <span className={styles.statLabel}>Win Rate</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.points)}</span>
                    <span className={styles.statLabel}>Points</span>
                  </div>
                </div>
                {!ranking && (
                  <p className={styles.muted}>
                    No ranking row exists for this account yet, so every stat reads 0.
                  </p>
                )}
              </section>
              <section className={styles.organizedSection}>
                <h2 className={styles.sectionTitle}>My Tournaments</h2>

                {organizedTournaments.length === 0 ? (
                  <EmptyState
                    icon='&#127942;'
                    title='No tournaments organized'
                    description='Tournaments you organize are listed here with their real status.'
                    action={
                      <Link href='/tournaments/create' className={styles.linkBtn}>
                        Create a tournament
                      </Link>
                    }
                  />
                ) : (
                  <ul className={styles.cardList}>
                    {organizedTournaments.map((tournament) => (
                      <li key={tournament.id} className={styles.cardItem}>
                        <div className={styles.cardInfo}>
                          <Link href={'/tournaments/' + tournament.id} className={styles.cardTitle}>
                            {tournament.name}
                          </Link>
                          <span className={styles.cardMeta}>
                            {getGameLabel(tournament.game)}
                          </span>
                          <span className={styles.cardMeta}>
                            Participant limit{' '}
                            {tournament.max_participants === null ||
                            tournament.max_participants === undefined
                              ? 'Unlimited'
                              : toNumber(tournament.max_participants)}
                          </span>
                          <span className={styles.cardMeta}>
                            Starts {formatDate(tournament.start_date)}
                          </span>
                        </div>
                        <span className={statusBadgeClass(tournament.status)}>
                          {getTournamentStatusLabel(tournament.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className={styles.registrationsSection}>
                <h2 className={styles.sectionTitle}>My Registrations</h2>

                {participations.length === 0 ? (
                  <EmptyState
                    icon='&#128101;'
                    title='No registrations'
                    description='Tournaments you join are listed here with their real status.'
                    action={
                      <Link href='/tournaments' className={styles.linkBtn}>
                        Browse tournaments
                      </Link>
                    }
                  />
                ) : (
                  <ul className={styles.cardList}>
                    {participations.map((row) => {
                      const tournament = row.tournament ?? null;
                      const canLeave =
                        Boolean(tournament) && CLOSING_STATUSES.includes(tournament.status);
                      return (
                        <li key={row.id} className={styles.cardItem}>
                          <div className={styles.cardInfo}>
                            <Link href={'/tournaments/' + row.tournament_id} className={styles.cardTitle}>
                              {tournament?.name ?? 'Tournament unavailable'}
                            </Link>
                            <span className={styles.cardMeta}>
                              {tournament ? getGameLabel(tournament.game) : 'Game unavailable'}
                            </span>
                            <span className={styles.cardMeta}>
                              {getTournamentStatusLabel(tournament?.status)}
                            </span>
                            <span className={styles.cardMeta}>
                              Joined {formatDate(row.joined_at)}
                            </span>
                            <span className={styles.cardMeta}>
                              Registration: {getParticipantStatusLabel(row.status)}
                            </span>
                          </div>
                          {canLeave ? (
                            <button
                              className={styles.leaveBtn}
                              type='button'
                              onClick={() => handleLeave(row.tournament_id)}
                              disabled={leavingId !== ''}
                            >
                              {leavingId === row.tournament_id ? 'Leaving...' : 'Leave'}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section className={styles.fixturesSection}>
                <h2 className={styles.sectionTitle}>Upcoming Fixtures</h2>

                {upcomingFixtures.length === 0 ? (
                  <EmptyState
                    icon='&#128197;'
                    title='No upcoming fixtures'
                    description='Scheduled matches involving your registrations appear here.'
                  />
                ) : (
                  <ul className={styles.cardList}>
                    {upcomingFixtures.map((fixture) => (
                      <li key={fixture.id} className={styles.cardItem}>
                        <div className={styles.cardInfo}>
                          <Link
                            href={'/tournaments/' + fixture.tournament_id + '/fixtures/' + fixture.id}
                            className={styles.cardTitle}
                          >
                            {participantLabel(fixture.home)} vs {participantLabel(fixture.away)}
                          </Link>
                          <span className={styles.cardMeta}>
                            {fixture.tournament?.name ?? 'Tournament unavailable'}
                          </span>
                          <span className={styles.cardMeta}>
                            Round {fixture.round ?? '-'} - {formatDateTime(fixture.scheduled_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </DataBoundary>
      </div>
    </div>
  );
}
