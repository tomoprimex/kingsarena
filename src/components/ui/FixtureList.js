import styles from './FixtureList.module.css';

export function FixtureList({ fixtures = [], title }) {
  return (
    <div className={styles.listWrapper}>
      {title && <h2 className={styles.title}>{title}</h2>}

      {fixtures.length === 0 ? (
        <p className={styles.emptyMessage}>No fixtures scheduled.</p>
      ) : (
        <ul className={styles.list} role='list'>
          {fixtures.map((fixture) => (
            <li key={fixture.id} className={styles.item}>
              <div className={styles.header}>
                <span className={styles.round}>
                  Round {fixture.round}
                  {fixture.match_number && <span className={styles.matchNum}> · Match {fixture.match_number}</span>}
                </span>
                <span className={styles.statusBadge + ' ' + styles[fixture.status?.toLowerCase()]}>
                  {fixture.status}
                </span>
              </div>

              <div className={styles.matchup}>
                <div className={styles.side}>
                  <span className={styles.label}>{fixture.home?.label}</span>
                  {fixture.hasResult && fixture.home?.score != null && (
                    <span className={styles.score}>{fixture.home.score}</span>
                  )}
                </div>

                <span className={styles.vs} aria-hidden='true'>
                  {fixture.hasResult ? '–' : 'vs'}
                </span>

                <div className={styles.side} style={{ flexDirection: 'row-reverse', textAlign: 'right' }}>
                  {fixture.hasResult && fixture.away?.score != null && (
                    <span className={styles.score}>{fixture.away.score}</span>
                  )}
                  <span className={styles.label}>{fixture.away?.label}</span>
                </div>
              </div>

              {fixture.scheduled_at && (
                <time className={styles.scheduled} dateTime={fixture.scheduled_at}>
                  {new Date(fixture.scheduled_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
