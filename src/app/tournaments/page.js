import Link from 'next/link';
import { getTournaments } from '../../lib/data/platform';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TournamentCard,
} from '../../components/ui';
import {
  GAMES,
  GAME_VALUES,
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_VALUES,
  getGameLabel,
  getTournamentFormatLabel,
} from '../../lib/constants';
import styles from './tournaments.module.css';

const PAGE_SIZE = 12;

function readFilters(sp) {
  const game = typeof sp.game === 'string' && GAME_VALUES.includes(sp.game) ? sp.game : '';
  const status =
    typeof sp.status === 'string' && TOURNAMENT_STATUS_VALUES.includes(sp.status) ? sp.status : '';
  const search = typeof sp.search === 'string' ? sp.search.trim() : '';
  const parsedPage = Number.parseInt(sp.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { game, status, search, page };
}

function buildHref(filters, overrides) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.game) params.set('game', merged.game);
  if (merged.status) params.set('status', merged.status);
  if (merged.search) params.set('search', merged.search);
  if (merged.page > 1) params.set('page', String(merged.page));

  const query = params.toString();
  return query ? `/tournaments?${query}` : '/tournaments';
}

export default async function TournamentsPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const filters = readFilters(sp);
  const offset = (filters.page - 1) * PAGE_SIZE;

  const { data, error } = await getTournaments({
    game: filters.game,
    status: filters.status,
    search: filters.search,
    limit: PAGE_SIZE,
    offset,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(filters.game || filters.status || filters.search);
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + rows.length, total);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          title='Tournaments'
          description='Browse every competition hosted on Kings Arena. Filter by game or status, then open one to register, follow the fixtures and check the standings.'
          action={
            <Link href='/tournaments/create' className={styles.createLink}>
              Create Tournament
            </Link>
          }
        />

        <form method='get' action='/tournaments' className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='game'>
              Game
            </label>
            <select
              className={styles.select}
              id='game'
              name='game'
              defaultValue={filters.game}
            >
              <option value=''>All games</option>
              {GAMES.map((game) => (
                <option key={game.value} value={game.value}>
                  {game.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='status'>
              Status
            </label>
            <select
              className={styles.select}
              id='status'
              name='status'
              defaultValue={filters.status}
            >
              <option value=''>All statuses</option>
              {TOURNAMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='search'>
              Search
            </label>
            <input
              className={styles.input}
              id='search'
              name='search'
              type='search'
              placeholder='Name or description'
              defaultValue={filters.search}
            />
          </div>
          <div className={styles.filterActions}>
            <button className={styles.applyBtn} type='submit'>
              Apply filters
            </button>
            {hasFilters && (
              <Link href='/tournaments' className={styles.resetLink}>
                Clear filters
              </Link>
            )}
          </div>
        </form>

        {error ? (
          <ErrorState error={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon='🏆'
            title='No tournaments match'
            description={
              hasFilters
                ? 'No tournament matches these filters. Clear them to see every competition on the platform.'
                : 'No tournament has been created yet. Be the first organizer on Kings Arena.'
            }
            action={
              hasFilters ? (
                <Link href='/tournaments' className={styles.resetLink}>
                  Clear filters
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <p className={styles.summary}>
              <span>
                Showing {rangeStart}-{rangeEnd} of {total}{' '}
                {total === 1 ? 'tournament' : 'tournaments'}
              </span>
              <span>Page {filters.page} of {totalPages}</span>
            </p>
            <div className={styles.grid}>
              {rows.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  gameLabel={getGameLabel(tournament.game)}
                  formatLabel={getTournamentFormatLabel(tournament.format)}
                />
              ))}
            </div>

            <nav className={styles.pagination} aria-label='Tournament pagination'>
              {filters.page > 1 ? (
                <Link
                  href={buildHref(filters, { page: filters.page - 1 })}
                  className={styles.pageLink}
                >
                  Previous
                </Link>
              ) : (
                <span className={styles.pageLink + ' ' + styles.pageLinkDisabled}>Previous</span>
              )}

              <span className={styles.summary}>
                Page {filters.page} of {totalPages}
              </span>

              {filters.page < totalPages ? (
                <Link
                  href={buildHref(filters, { page: filters.page + 1 })}
                  className={styles.pageLink}
                >
                  Next
                </Link>
              ) : (
                <span className={styles.pageLink + ' ' + styles.pageLinkDisabled}>Next</span>
              )}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
