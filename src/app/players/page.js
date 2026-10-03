import Link from 'next/link';

import { EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { getPlayers } from '../../lib/data/platform';
import styles from './players.module.css';

const PAGE_SIZE = 12;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}

function buildHref({ search, page }) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/players?${query}` : '/players';
}

export const metadata = {
  title: 'Players - KINGS ARENA',
  description: 'Browse every registered player and their real recorded results.',
};

export default async function PlayersPage({ searchParams }) {
  const sp = await searchParams;
  const search = readString(sp.search).trim();
  const requestedPage = Number.parseInt(readString(sp.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error } = await getPlayers({ limit: PAGE_SIZE, offset, search: search || undefined });
  const rows = data?.rows ?? [];
  const total = toNumber(data?.count);
  const hasResults = rows.length > 0;
  const canGoBack = page > 1;
  const canGoForward = hasResults && offset + rows.length < total;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <PageHeader
            title='Players'
            description='Every registered player with the stats recorded from their submitted results.'
          />

          <form method='get' action='/players' className={styles.searchForm}>
            <label className={styles.searchLabel} htmlFor='player-search'>Search players</label>
            <div className={styles.searchRow}>
              <input
                id='player-search'
                type='search'
                name='search'
                defaultValue={search}
                placeholder='Username or display name'
                className={styles.searchInput}
              />
              <button type='submit' className={styles.searchButton}>Search</button>
              {search ? (
                <Link href='/players' className={styles.clearButton}>Clear</Link>
              ) : null}
            </div>
          </form>

          {error && <ErrorState error={error} />}

          {!error && rows.length === 0 && (
            <EmptyState
              icon='&#128100;'
              title={search ? 'No players found' : 'No players yet'}
              description={
                search
                  ? `No player matches &apos;${search}&apos;.`
                  : 'Players appear here as soon as accounts are created.'
              }
            />
          )}

          {!error && hasResults && (
            <>
              <p className={styles.resultCount}>
                {total} {total === 1 ? 'player' : 'players'}
                {search ? ` matching &apos;${search}&apos;` : ''}
              </p>
              <div className={styles.grid}>
                {rows.map((player) => (
                  <article key={player.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      {player.profile_picture ? (
                        <img src={player.profile_picture} alt='' className={styles.avatar} />
                      ) : (
                        <div className={styles.avatarFallback} aria-hidden='true'>&#128100;</div>
                      )}
                      <div className={styles.identity}>
                        <Link href={`/profile/${player.username}`} className={styles.nameLink}>
                          {player.display_name}
                        </Link>
                        <span className={styles.username}>@{player.username}</span>
                      </div>
                      {player.rank !== null && (
                        <span className={styles.rank}>#{toNumber(player.rank)}</span>
                      )}
                    </div>

                    {player.bio && <p className={styles.bio}>{player.bio}</p>}

                    <dl className={styles.stats}>
                      <div className={styles.stat}>
                        <dt>Points</dt>
                        <dd>{toNumber(player.points)}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>Matches</dt>
                        <dd>{toNumber(player.matches)}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>Win Rate</dt>
                        <dd>{player.win_rate ?? 0}</dd>
                      </div>
                      <div className={styles.stat}>
                        <dt>Tournaments</dt>
                        <dd>{toNumber(player.tournaments_entered)}</dd>
                      </div>
                    </dl>

                    <Link href={`/profile/${player.username}`} className={styles.profileLink}>
                      View profile
                    </Link>
                  </article>
                ))}
              </div>

              <nav className={styles.pagination} aria-label='Players pagination'>
                {canGoBack ? (
                  <Link href={buildHref({ search, page: page - 1 })} className={styles.pageLink}>
                    Previous
                  </Link>
                ) : (
                  <span className={`${styles.pageLink} ${styles.pageLinkDisabled}`}>Previous</span>
                )}
                <span className={styles.pageStatus}>Page {page}</span>
                {canGoForward ? (
                  <Link href={buildHref({ search, page: page + 1 })} className={styles.pageLink}>
                    Next
                  </Link>
                ) : (
                  <span className={`${styles.pageLink} ${styles.pageLinkDisabled}`}>Next</span>
                )}
              </nav>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
