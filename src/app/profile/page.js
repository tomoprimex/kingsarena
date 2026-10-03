'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DataBoundary, EmptyState } from '../../components/ui';
import { useRequireAuth } from '../../contexts/AuthContext';
import { fetchMyProfile } from '../../lib/data/client';
import { getProfileByUsername } from '../../lib/data/platform';
import {
  GAMES,
  GAME_PROFILE_FLAGS,
  getGameLabel,
  getTournamentStatusLabel,
} from '../../lib/constants';
import styles from './profile.module.css';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWinRate(value) {
  if (value === null || value === undefined || value === '') return '0%';
  if (typeof value === 'string') return value;
  const parsed = toNumber(value);
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return Math.round(percent) + '%';
}

async function loadOwnProfile(userId) {
  const { data: own, error: ownError } = await fetchMyProfile(userId);

  if (ownError) return { data: null, error: ownError };
  if (!own) return { data: null, error: { message: 'No profile is linked to this account yet.' } };

  const { data: history, error: historyError } = await getProfileByUsername(own.username);

  if (historyError) return { data: null, error: historyError };
  return { data: history ?? { profile: own, ranking: null, stats: [] }, error: null };
}

export default function ProfilePage() {
  const { user, loading: authLoading, configError } = useRequireAuth();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyResult = useCallback((result) => {
    if (result.error) {
      setPayload(null);
      setLoadError(result.error);
    } else {
      setPayload(result.data);
      setLoadError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    let active = true;

    loadOwnProfile(user.id).then((result) => {
      if (active) applyResult(result);
    });

    return () => {
      active = false;
    };
  }, [authLoading, user, applyResult]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await loadOwnProfile(user.id);
    applyResult(result);
  }, [user, applyResult]);

  if (authLoading) {
    return (
      <div className={styles.loading}></div>
    );
  }

  if (configError || !user) {
    return null;
  }

  const profile = payload?.profile ?? null;
  const ranking = payload?.ranking ?? null;
  const stats = payload?.stats ?? [];
  const games = GAMES.filter((game) => profile?.[GAME_PROFILE_FLAGS[game.value]] === true);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <DataBoundary
          loading={loading}
          error={loadError}
          isEmpty={!loading && !loadError && !profile}
          onRetry={reload}
          empty={
            <EmptyState
              icon='&#128100;'
              title='No profile'
              description='There is no player profile linked to this account yet.'
            />
          }
        >
          {profile && (
            <>
              <div className={styles.profileHeader}>
                <div className={styles.profileCover} aria-hidden='true' />
                <div className={styles.profileInfo}>
                  {profile.profile_picture ? (
                    <img src={profile.profile_picture} alt='' className={styles.avatar} />
                  ) : (
                    <div className={styles.avatar} aria-hidden='true'>
                      &#128100;
                    </div>
                  )}
                  <div className={styles.profileDetails}>
                    <h1 className={styles.profileName}>{profile.display_name}</h1>
                    <p className={styles.profileUsername}>@{profile.username}</p>
                    {profile.bio ? (
                      <p className={styles.profileBio}>{profile.bio}</p>
                    ) : (
                      <p className={styles.profileBio}>No bio yet.</p>
                    )}
                    {games.length > 0 && (
                      <ul className={styles.gameFlags}>
                        {games.map((game) => (
                          <li key={game.value} className={styles.gameFlag}>
                            {game.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link href='/settings' className={styles.editBtn}>
                    Edit profile
                  </Link>
                </div>
              </div>
              <section className={styles.statsSection}>
                <h2 className={styles.sectionTitle}>Statistics</h2>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.tournaments_entered)}</span>
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
                    <span className={styles.statValue}>{toNumber(ranking?.drew)}</span>
                    <span className={styles.statLabel}>Drew</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.lost)}</span>
                    <span className={styles.statLabel}>Lost</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{formatWinRate(ranking?.win_rate)}</span>
                    <span className={styles.statLabel}>Win Rate</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.goals_for)}</span>
                    <span className={styles.statLabel}>Goals For</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{toNumber(ranking?.goals_against)}</span>
                    <span className={styles.statLabel}>Goals Against</span>
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
              <section className={styles.historySection}>
                <h2 className={styles.sectionTitle}>Tournament History</h2>

                {stats.length === 0 ? (
                  <EmptyState
                    icon='&#127942;'
                    title='No tournament history'
                    description='Recorded results from player_tournament_stats appear here once you enter a tournament.'
                  />
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope='col' className={styles.nameCol}>Tournament</th>
                          <th scope='col' className={styles.statCol}>Game</th>
                          <th scope='col' className={styles.statCol}>Status</th>
                          <th scope='col' className={styles.statCol}>P</th>
                          <th scope='col' className={styles.statCol}>W</th>
                          <th scope='col' className={styles.statCol}>D</th>
                          <th scope='col' className={styles.statCol}>L</th>
                          <th scope='col' className={styles.statCol}>GF</th>
                          <th scope='col' className={styles.statCol}>GA</th>
                          <th scope='col' className={styles.statCol}>GD</th>
                          <th scope='col' className={styles.statCol}>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((row) => {
                          const difference = toNumber(row.goal_difference);
                          return (
                            <tr key={row.tournament_id + '-' + row.game}>
                              <td className={styles.tournamentCell}>
                                <Link href={'/tournaments/' + row.tournament_id}>
                                  {row.tournament_name}
                                </Link>
                              </td>
                              <td className={styles.statCell}>{getGameLabel(row.game)}</td>
                              <td className={styles.statCell}>
                                {getTournamentStatusLabel(row.tournament_status)}
                              </td>
                              <td className={styles.statCell}>{toNumber(row.played)}</td>
                              <td className={styles.statCell}>{toNumber(row.won)}</td>
                              <td className={styles.statCell}>{toNumber(row.drew)}</td>
                              <td className={styles.statCell}>{toNumber(row.lost)}</td>
                              <td className={styles.statCell}>{toNumber(row.goals_for)}</td>
                              <td className={styles.statCell}>{toNumber(row.goals_against)}</td>
                              <td className={styles.statCell}>
                                {difference > 0 ? '+' + difference : difference}
                              </td>
                              <td className={styles.pointsCell}>{toNumber(row.points)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </DataBoundary>
      </div>
    </div>
  );
}
