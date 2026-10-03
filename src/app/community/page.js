import Link from 'next/link';

import { EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { getCommunityProfiles } from '../../lib/data/platform';
import styles from './community.module.css';

const COMMUNITY_LIMIT = 24;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const metadata = {
  title: 'Community - KINGS ARENA',
  description: 'The Kings Arena member directory.',
};

export default async function CommunityPage() {
  const { data, error } = await getCommunityProfiles({ limit: COMMUNITY_LIMIT });
  const members = data ?? [];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <PageHeader
            title='Community'
            description='Every registered member of Kings Arena, with the stats recorded on the platform.'
          />

          {error && <ErrorState error={error} />}

          {!error && members.length === 0 && (
            <EmptyState
              icon='&#128101;'
              title='No members yet'
              description='The directory fills up as players join the arena.'
            />
          )}

          {!error && members.length > 0 && (
            <div className={styles.grid}>
              {members.map((member) => (
                <article key={member.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    {member.profile_picture ? (
                      <img src={member.profile_picture} alt='' className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarFallback} aria-hidden='true'>&#128100;</div>
                    )}
                    <div className={styles.identity}>
                      <Link href={`/profile/${member.username}`} className={styles.nameLink}>
                        {member.display_name}
                      </Link>
                      <span className={styles.username}>@{member.username}</span>
                    </div>
                    {member.rank !== null && (
                      <span className={styles.rank}>#{toNumber(member.rank)}</span>
                    )}
                  </div>

                  {member.bio && <p className={styles.bio}>{member.bio}</p>}

                  <dl className={styles.stats}>
                    <div className={styles.stat}>
                      <dt>Points</dt>
                      <dd>{toNumber(member.points)}</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Matches</dt>
                      <dd>{toNumber(member.matches)}</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Win Rate</dt>
                      <dd>{member.win_rate ?? 0}</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Tournaments</dt>
                      <dd>{toNumber(member.tournaments_entered)}</dd>
                    </div>
                  </dl>

                  <Link href={`/profile/${member.username}`} className={styles.profileLink}>
                    View profile
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
