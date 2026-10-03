import Link from 'next/link';
import AuthActions from '../components/home/AuthActions';
import { EmptyState, ErrorState, TournamentCard } from '../components/ui';
import { GAMES, getGameLabel, getTournamentFormatLabel } from '../lib/constants';
import { getFeaturedTournaments, getPlatformStats, getRankings } from '../lib/data/platform';
import { getSupabaseServer } from '../lib/supabaseServer';
import styles from './page.module.css';

const FEATURED_TOURNAMENT_LIMIT = 6;
const RANKINGS_PREVIEW_LIMIT = 5;

const CONFIG_ERROR = {
  message:
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
};

// Decorative glyphs only. Labels and counts come from the database.
const GAME_ICONS = {
  dls: '\u26BD',
  efootball: '\uD83C\uDFAE',
  fcmobile: '\uD83D\uDCF1',
  cod: '\uD83D\uDD2B',
};

const RANK_BADGES = ['rankGold', 'rankSilver', 'rankBronze'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value) {
  return toNumber(value).toLocaleString('en-US');
}

function rankClass(rank) {
  return RANK_BADGES[rank - 1] ?? 'rank';
}

async function getTournamentCountsByGame() {
  const supabase = getSupabaseServer();
  if (!supabase) return { data: null, error: CONFIG_ERROR };

  const results = await Promise.all(
    GAMES.map((game) =>
      supabase
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('game', game.value)
        .limit(1),
    ),
  );

  const error = results.find((result) => result.error)?.error;
  if (error) return { data: null, error };

  const counts = {};
  GAMES.forEach((game, index) => {
    counts[game.value] = results[index].count ?? 0;
  });
  return { data: counts, error: null };
}

export default async function Home() {
  const [statsResult, featuredResult, rankingsResult, gameCountsResult] = await Promise.all([
    getPlatformStats(),
    getFeaturedTournaments(FEATURED_TOURNAMENT_LIMIT),
    getRankings({ limit: RANKINGS_PREVIEW_LIMIT }),
    getTournamentCountsByGame(),
  ]);

  const tournaments = featuredResult.data ?? [];
  const rankings = rankingsResult.data ?? [];
  const gameCounts = gameCountsResult.data;
  const year = new Date().getFullYear();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>&#128081;</span>
            <span className={styles.logoText}>KINGS ARENA</span>
          </div>
          <nav className={styles.nav}>
            <a href="#tournaments" className={styles.navLink}>Tournaments</a>
            <a href="#games" className={styles.navLink}>Games</a>
            <a href="#rankings" className={styles.navLink}>Rankings</a>
            <a href="#community" className={styles.navLink}>Community</a>
          </nav>
          <div className={styles.authButtons}>
            <AuthActions />
          </div>
        </div>
      </header>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroTitleHighlight}>DOMINATE</span> THE ARENA
            </h1>
            <p className={styles.heroSubtitle}>
              The ultimate esports tournament platform for competitive gamers.
              Compete in Dream League Soccer, eFootball, FC Mobile, and Call of Duty tournaments.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/tournaments" className={styles.primaryBtn}>Browse Tournaments</Link>
              <Link href="/signup" className={styles.secondaryBtn}>Create Tournament</Link>
            </div>

            {statsResult.error ? (
              <ErrorState error={statsResult.error} />
            ) : (
              <div className={styles.heroStats}>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {formatCount(statsResult.data?.totalPlayers)}
                  </span>
                  <span className={styles.statLabel}>Registered Players</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {formatCount(statsResult.data?.totalTournaments)}
                  </span>
                  <span className={styles.statLabel}>Tournaments</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {formatCount(statsResult.data?.activeTournaments)}
                  </span>
                  <span className={styles.statLabel}>Open &amp; Ongoing</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {formatCount(statsResult.data?.totalFixtures)}
                  </span>
                  <span className={styles.statLabel}>Fixtures</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section id="tournaments" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Live Tournaments</h2>
            <Link href="/tournaments" className={styles.viewAll}>View All &rarr;</Link>
          </div>

          {featuredResult.error && <ErrorState error={featuredResult.error} />}

          {!featuredResult.error && tournaments.length === 0 && (
            <EmptyState
              icon='&#127942;'
              title='The arena is empty'
              description='No tournaments yet &mdash; be the first to create one.'
              action={
                <Link href="/tournaments/create" className={styles.secondaryBtn}>
                  Create Tournament
                </Link>
              }
            />
          )}

          {!featuredResult.error && tournaments.length > 0 && (
            <div className={styles.tournamentGrid}>
              {tournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  gameLabel={getGameLabel(tournament.game)}
                  formatLabel={getTournamentFormatLabel(tournament.format)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
      <section id="games" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Supported Games</h2>
          </div>
          <div className={styles.gamesGrid}>
            {GAMES.map((game) => {
              const count = gameCounts ? toNumber(gameCounts[game.value]) : null;
              return (
                <Link
                  key={game.value}
                  href={'/tournaments?game=' + game.value}
                  className={styles.gameCard}
                >
                  <div className={styles.gameIcon} aria-hidden='true'>{GAME_ICONS[game.value]}</div>
                  <h3 className={styles.gameName}>{game.label}</h3>
                  {count !== null && (
                    <span className={styles.gameCount}>
                      {formatCount(count)} {count === 1 ? 'Tournament' : 'Tournaments'}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section id="rankings" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Players</h2>
            <Link href="/rankings" className={styles.viewAll}>View Rankings &rarr;</Link>
          </div>

          {rankingsResult.error && <ErrorState error={rankingsResult.error} />}

          {!rankingsResult.error && rankings.length === 0 && (
            <EmptyState
              icon='&#128081;'
              title='No ranked players yet'
              description='Nobody has played a match yet, so there is nobody to rank.'
            />
          )}

          {!rankingsResult.error && rankings.length > 0 && (
            <div className={styles.rankingsTable}>
              <div className={styles.rankingsHeader}>
                <span>Rank</span>
                <span>Player</span>
                <span>Win Rate</span>
                <span>Points</span>
              </div>
              {rankings.map((row) => {
                const rank = toNumber(row.rank);
                return (
                  <div key={row.user_id} className={styles.rankingsRow}>
                    <span className={styles[rankClass(rank)]}>#{rank}</span>
                    <Link href={'/profile/' + row.username} className={styles.playerInfo}>
                      {row.profile_picture ? (
                        <img
                          src={row.profile_picture}
                          alt=''
                          className={styles.playerAvatarImage}
                          aria-hidden='true'
                        />
                      ) : null}
                      <span className={styles.playerNames}>
                        <span className={styles.playerDisplayName}>
                          {row.display_name || row.username}
                        </span>
                        <span className={styles.playerUsername}>@{row.username}</span>
                      </span>
                    </Link>
                    <span className={styles.winRate}>{row.win_rate ?? 0}%</span>
                    <span>{formatCount(row.points)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <section id="community" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.communityContent}>
            <h2 className={styles.communityTitle}>Join the Elite Community</h2>
            <p className={styles.communityDesc}>
              Connect with competitive gamers, share strategies,
              and rise through the ranks together.
            </p>
            <div className={styles.communityFeatures}>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>&#127942;</span>
                <h4>Tournament Hosting</h4>
                <p>Create and manage your own tournaments</p>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>&#128202;</span>
                <h4>Statistics &amp; Analytics</h4>
                <p>Track your performance and improve</p>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>&#128172;</span>
                <h4>Community Forums</h4>
                <p>Discuss strategies and connect</p>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureIcon}>&#127873;</span>
                <h4>Rewards &amp; Prizes</h4>
                <p>Earn rewards for your achievements</p>
              </div>
            </div>
            <Link href="/signup" className={styles.primaryBtn}>Get Started Free</Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerContent}>
            <div className={styles.footerSection}>
              <div className={styles.logo}>
                <span className={styles.logoIcon}>&#128081;</span>
                <span className={styles.logoText}>KINGS ARENA</span>
              </div>
              <p className={styles.footerDesc}>
                The ultimate esports tournament platform for competitive gaming communities.
              </p>
            </div>
            <div className={styles.footerSection}>
              <h4>Platform</h4>
              <Link href="/tournaments">Tournaments</Link>
              <Link href="/rankings">Rankings</Link>
              <Link href="/community">Community</Link>
              <Link href="/players">Players</Link>
              <Link href="/teams">Teams</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; {year} KINGS ARENA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
