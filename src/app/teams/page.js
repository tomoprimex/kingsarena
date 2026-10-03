import Link from 'next/link';
import { getTeams } from '../../lib/data/platform';
import { EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { getGameLabel } from '../../lib/constants';
import styles from './teams.module.css';

const PAGE_SIZE = 24;

function ownerLabel(team) {
  return team.owner?.display_name ?? team.owner?.username ?? 'Unknown';
}

export default async function TeamsPage() {
  const { data, error } = await getTeams({ limit: PAGE_SIZE });
  const teams = data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          title='Teams'
          description='Every team registered on Kings Arena, newest first. Open a team to see its real roster and the tournaments it has entered.'
          action={
            <Link href='/teams/create' className={styles.createLink}>
              Create Team
            </Link>
          }
        />

        {error ? (
          <ErrorState error={error} />
        ) : teams.length === 0 ? (
          <EmptyState
            icon='👥'
            title='No teams yet'
            description='No team has been registered on Kings Arena. Create the first one and invite your squad.'
            action={
              <Link href='/teams/create' className={styles.createLink}>
                Create Team
              </Link>
            }
          />
        ) : (
          <>
            <p className={styles.summary}>
              Showing {teams.length} {teams.length === 1 ? 'team' : 'teams'}
            </p>
            <div className={styles.grid}>
              {teams.map((team) => (
                <Link key={team.id} href={'/teams/' + team.id} className={styles.card}>
                  <div className={styles.cardBadges}>
                    <span className={styles.badge + ' ' + styles.badgeGame}>
                      {getGameLabel(team.game)}
                    </span>
                    <span className={styles.badge}>
                      {team.member_count}{' '}
                      {team.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  <h2 className={styles.cardTitle}>{team.name}</h2>

                  <p className={styles.cardText}>
                    {team.description || 'No description provided.'}
                  </p>

                  <p className={styles.cardMeta}>
                    Owned by {ownerLabel(team)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
