'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataBoundary, EmptyState, PageHeader } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchOrganizedTournaments } from '../../../lib/data/admin';
import {
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_VALUES,
  getGameLabel,
  getTournamentFormatLabel,
  getTournamentStatusLabel,
} from '../../../lib/constants';
import styles from './admin-tournaments.module.css';

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

export default function AdminTournamentsPage() {
  const { user, loading: authLoading, configError } = useAuth();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await fetchOrganizedTournaments(user.id);
    setPayload(data);
    setLoadError(error);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    let active = true;

    fetchOrganizedTournaments(user.id).then(({ data, error }) => {
      if (!active) return;
      setPayload(data);
      setLoadError(error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const rows = useMemo(() => payload?.rows ?? [], [payload]);
  const totals = payload?.totals ?? null;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (!term) return true;
      return row.name.toLowerCase().includes(term) || row.game.toLowerCase().includes(term);
    });
  }, [rows, search, statusFilter]);

  const hasFilters = Boolean(statusFilter || search.trim());

  if (!authLoading && !configError && !user) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <EmptyState
              icon='🔐'
              title='Sign in to open the organizer control centre'
              description='The control centre only lists tournaments attached to your own organizer profile.'
              action={
                <Link href='/login' className={styles.createLink}>
                  Go to sign in
                </Link>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <PageHeader
            title='Organizer control centre'
            description='Every tournament you organize, with live counts and shortcuts into the fixtures, results and participant controls.'
            action={
              <Link href='/tournaments/create' className={styles.createLink}>
                New tournament
              </Link>
            }
          />

          <DataBoundary
            loading={loading || authLoading}
            error={loadError}
            onRetry={load}
          >
            {totals && (
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Tournaments</span>
                  <span className={styles.statValue}>{totals.tournaments}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Live now</span>
                  <span className={styles.statValue}>{totals.live}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Registrations</span>
                  <span className={styles.statValue}>{totals.participants}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Fixtures</span>
                  <span className={styles.statValue}>{totals.fixtures}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Results in</span>
                  <span className={styles.statValue}>{totals.played}</span>
                </div>
              </div>
            )}

            <form className={styles.filters} onSubmit={(event) => event.preventDefault()}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor='admin-status'>
                  Status
                </label>
                <select
                  className={styles.select}
                  id='admin-status'
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value=''>All statuses</option>
                  {TOURNAMENT_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor='admin-search'>
                  Search
                </label>
                <input
                  className={styles.input}
                  id='admin-search'
                  type='search'
                  placeholder='Tournament name or game'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {hasFilters && (
                <button
                  className={styles.resetBtn}
                  type='button'
                  onClick={() => {
                    setStatusFilter('');
                    setSearch('');
                  }}
                >
                  Clear filters
                </button>
              )}
            </form>

            {rows.length === 0 ? (
              <EmptyState
                icon='🏆'
                title='You have not organized a tournament yet'
                description='Create a competition and it will show up here with its registrations, fixtures and results.'
                action={
                  <Link href='/tournaments/create' className={styles.createLink}>
                    New tournament
                  </Link>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon='🔍'
                title='No tournament matches'
                description='None of your tournaments match these filters.'
                action={
                  <button
                    className={styles.resetBtn}
                    type='button'
                    onClick={() => {
                      setStatusFilter('');
                      setSearch('');
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <>
                <p className={styles.summary}>
                  Showing {visible.length} of {rows.length}{' '}
                  {rows.length === 1 ? 'tournament' : 'tournaments'}
                </p>

                <ul className={styles.rowList}>
                  {visible.map((tournament) => {
                    const badgeClass =
                      styles.badge +
                      ' ' +
                      (STATUS_BADGE_CLASSES[tournament.status] ??
                        (TOURNAMENT_STATUS_VALUES.includes(tournament.status) ? styles.badge : ''));

                    return (
                      <li key={tournament.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowBadges}>
                            <span className={styles.gameBadge}>
                              {getGameLabel(tournament.game)}
                            </span>
                            <span className={badgeClass}>
                              {getTournamentStatusLabel(tournament.status)}
                            </span>
                          </div>
                          <h2 className={styles.rowTitle}>{tournament.name}</h2>
                          <p className={styles.rowMeta}>
                            {getTournamentFormatLabel(tournament.format)}
                            {' · '}
                            {tournament.participant_count} / {tournament.max_participants ?? '∞'}{' '}
                            participants
                            {' · '}
                            {tournament.fixture_count} fixtures ({tournament.played_count} played)
                            {' · '}
                            starts {formatDate(tournament.start_date)}
                          </p>
                        </div>
                        <div className={styles.rowActions}>
                          <Link
                            href={'/admin/tournaments/' + tournament.id}
                            className={styles.primaryBtn}
                          >
                            Open control centre
                          </Link>
                          <Link
                            href={'/tournaments/' + tournament.id}
                            className={styles.secondaryBtn}
                          >
                            Public page
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </DataBoundary>
        </div>
      </main>
    </div>
  );
}
