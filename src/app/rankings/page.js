import Link from 'next/link';

import { EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { getRankings } from '../../lib/data/platform';
import styles from './rankings.module.css';

const RANKINGS_LIMIT = 100;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const metadata = {
  title: 'Rankings - KINGS ARENA',
  description: 'Live player rankings computed from submitted match results.',
};

export default async function RankingsPage() {
  const { data, error } = await getRankings({ limit: RANKINGS_LIMIT });
  const rows = data ?? [];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <PageHeader
            title='Rankings'
            description='Positions are computed by the database from every submitted match result.'
          />

          {error && <ErrorState error={error} />}

          {!error && rows.length === 0 && (
            <EmptyState
              icon='&#127942;'
              title='No ranked players yet'
              description='Results will appear once matches are played.'
            />
          )}

          {!error && rows.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope='col' className={styles.posCol}>Position</th>
                    <th scope='col' className={styles.playerCol}>Player</th>
                    <th scope='col' className={styles.statCol}>Tournaments</th>
                    <th scope='col' className={styles.statCol}>Played</th>
                    <th scope='col' className={styles.statCol}>W</th>
                    <th scope='col' className={styles.statCol}>D</th>
                    <th scope='col' className={styles.statCol}>L</th>
                    <th scope='col' className={styles.statCol}>Win Rate</th>
                    <th scope='col' className={styles.statCol}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user_id} className={styles.row}>
                      <td className={styles.posCell}>
                        <span className={styles.rankBadge}>#{toNumber(row.rank)}</span>
                      </td>
                      <td className={styles.playerCell}>
                        <Link href={`/profile/${row.username}`} className={styles.playerLink}>
                          {row.profile_picture && (
                            <img src={row.profile_picture} alt='' className={styles.avatar} />
                          )}
                          <span className={styles.playerNames}>
                            <span className={styles.displayName}>{row.display_name}</span>
                            <span className={styles.username}>@{row.username}</span>
                          </span>
                        </Link>
                      </td>
                      <td className={styles.statCell}>{toNumber(row.tournaments_entered)}</td>
                      <td className={styles.statCell}>{toNumber(row.played)}</td>
                      <td className={styles.statCell}>{toNumber(row.won)}</td>
                      <td className={styles.statCell}>{toNumber(row.drew)}</td>
                      <td className={styles.statCell}>{toNumber(row.lost)}</td>
                      <td className={styles.statCell}>{row.win_rate ?? 0}</td>
                      <td className={styles.pointsCell}>{toNumber(row.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
