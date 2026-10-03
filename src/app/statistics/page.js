import { ErrorState, PageHeader } from '../../components/ui';
import { GAMES, TOURNAMENT_STATUSES } from '../../lib/constants';
import { getGlobalStatistics } from '../../lib/data/platform';
import styles from './statistics.module.css';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const metadata = {
  title: 'Statistics - KINGS ARENA',
  description: 'Platform-wide totals computed directly from the database.',
};

export default async function StatisticsPage() {
  const { data, error } = await getGlobalStatistics();

  const totalPlayers = toNumber(data?.totalPlayers);
  const totalTournaments = toNumber(data?.totalTournaments);
  const totalFixturesPlayed = toNumber(data?.totalFixturesPlayed);
  const totalGoals = toNumber(data?.totalGoals);
  const tournamentsByStatus = data?.tournamentsByStatus ?? {};
  const tournamentsByGame = data?.tournamentsByGame ?? {};

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <PageHeader
            title='Statistics'
            description='Every figure below is aggregated live from the platform database.'
          />

          {error && <ErrorState error={error} />}

          {!error && (
            <>
              <div className={styles.headlineGrid}>
                <div className={styles.headlineCard}>
                  <span className={styles.headlineValue}>{totalPlayers}</span>
                  <span className={styles.headlineLabel}>Total players</span>
                </div>
                <div className={styles.headlineCard}>
                  <span className={styles.headlineValue}>{totalTournaments}</span>
                  <span className={styles.headlineLabel}>Total tournaments</span>
                </div>
                <div className={styles.headlineCard}>
                  <span className={styles.headlineValue}>{totalFixturesPlayed}</span>
                  <span className={styles.headlineLabel}>Fixtures played</span>
                </div>
                <div className={styles.headlineCard}>
                  <span className={styles.headlineValue}>{totalGoals}</span>
                  <span className={styles.headlineLabel}>Goals from submitted results</span>
                </div>
              </div>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tournaments by status</h2>
                <div className={styles.barList}>
                  {TOURNAMENT_STATUSES.map((status) => {
                    const count = toNumber(tournamentsByStatus[status.value]);
                    const percent = totalTournaments > 0 ? (count / totalTournaments) * 100 : 0;
                    return (
                      <div key={status.value} className={styles.barRow}>
                        <span className={styles.barLabel}>{status.label}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${percent}%` }}
                            role='presentation'
                          />
                        </div>
                        <span className={styles.barValue}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tournaments by game</h2>
                <div className={styles.barList}>
                  {GAMES.map((game) => {
                    const count = toNumber(tournamentsByGame[game.value]);
                    const percent = totalTournaments > 0 ? (count / totalTournaments) * 100 : 0;
                    return (
                      <div key={game.value} className={styles.barRow}>
                        <span className={styles.barLabel}>{game.label}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${percent}%` }}
                            role='presentation'
                          />
                        </div>
                        <span className={styles.barValue}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
