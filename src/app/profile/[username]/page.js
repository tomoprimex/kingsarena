import { notFound } from 'next/navigation';

import { EmptyState, ErrorState, PageHeader } from '../../../components/ui';
import { GAMES, GAME_PROFILE_FLAGS, getGameLabel, getTournamentStatusLabel } from '../../../lib/constants';
import { getProfileByUsername } from '../../../lib/data/platform';
import styles from './profile.module.css';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `${username} - KINGS ARENA`,
    description: `Public profile and tournament history for @${username}.`,
  };
}

export default async function PublicProfilePage({ params }) {
  const { username } = await params;
  const { data, error } = await getProfileByUsername(username);

  if (error) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <ErrorState error={error} />
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const { profile, stats } = data;
  const playedGames = GAMES.filter((game) => profile[GAME_PROFILE_FLAGS[game.value]] === true);
  const hasHistory = stats.length > 0;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.header}>
            {profile.profile_picture ? (
              <img src={profile.profile_picture} alt='' className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback} aria-hidden='true'>&#128100;</div>
            )}
            <div className={styles.identity}>
              <h1 className={styles.displayName}>{profile.display_name}</h1>
              <p className={styles.username}>@{profile.username}</p>
              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
              {playedGames.length > 0 && (
                <ul className={styles.gameFlags}>
                  {playedGames.map((game) => (
                    <li key={game.value} className={styles.gameFlag}>{game.label}</li>
                  ))}
                </ul>
              )}
            </div>
            {profile.rank !== null && (
              <span className={styles.rank}>#{toNumber(profile.rank)}</span>
            )}
          </section>

          <dl className={styles.overview}>
            <div className={styles.overviewCard}>
              <dt>Points</dt>
              <dd>{toNumber(profile.points)}</dd>
            </div>
            <div className={styles.overviewCard}>
              <dt>Matches</dt>
              <dd>{toNumber(profile.matches)}</dd>
            </div>
            <div className={styles.overviewCard}>
              <dt>Win Rate</dt>
              <dd>{profile.win_rate ?? 0}</dd>
            </div>
            <div className={styles.overviewCard}>
              <dt>Tournaments</dt>
              <dd>{toNumber(profile.tournaments_entered)}</dd>
            </div>
            <div className={styles.overviewCard}>
              <dt>Goals For</dt>
              <dd>{toNumber(profile.goals_for)}</dd>
            </div>
            <div className={styles.overviewCard}>
              <dt>Goals Against</dt>
              <dd>{toNumber(profile.goals_against)}</dd>
            </div>
          </dl>

          <PageHeader title='Tournament history' description='Recorded results from every tournament this player entered.' />

          {!hasHistory ? (
            <EmptyState
              icon='&#127942;'
              title='No tournament history'
              description='This player has no recorded tournament results yet.'
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
                      <tr key={`${row.tournament_id}-${row.game}`}>
                        <td className={styles.tournamentCell}>{row.tournament_name}</td>
                        <td className={styles.statCell}>{getGameLabel(row.game)}</td>
                        <td className={styles.statCell}>{getTournamentStatusLabel(row.tournament_status)}</td>
                        <td className={styles.statCell}>{toNumber(row.played)}</td>
                        <td className={styles.statCell}>{toNumber(row.won)}</td>
                        <td className={styles.statCell}>{toNumber(row.drew)}</td>
                        <td className={styles.statCell}>{toNumber(row.lost)}</td>
                        <td className={styles.statCell}>{toNumber(row.goals_for)}</td>
                        <td className={styles.statCell}>{toNumber(row.goals_against)}</td>
                        <td className={styles.statCell}>{difference > 0 ? `+${difference}` : difference}</td>
                        <td className={styles.pointsCell}>{toNumber(row.points)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}



