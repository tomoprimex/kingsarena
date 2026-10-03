import styles from './StandingsTable.module.css';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const pointsDiff = toNumber(b.points) - toNumber(a.points);
    if (pointsDiff !== 0) return pointsDiff;
    const gdDiff = toNumber(b.goal_difference) - toNumber(a.goal_difference);
    if (gdDiff !== 0) return gdDiff;
    return toNumber(b.goals_for) - toNumber(a.goals_for);
  });
}

export function StandingsTable({ rows = [], title }) {
  const sortedRows = sortRows(rows);

  if (sortedRows.length === 0) {
    return (
      <div className={styles.tableWrapper}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope='col' className={styles.posCol}>Pos</th>
              <th scope='col' className={styles.nameCol}>Name</th>
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
            <tr>
              <td colSpan={10} className={styles.emptyRow}>No results recorded yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope='col' className={styles.posCol}>Pos</th>
              <th scope='col' className={styles.nameCol}>Name</th>
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
            {sortedRows.map((row, index) => (
              <tr key={row.participant_id} className={index === 0 ? styles.topRow : ''}>
                <td className={styles.posCell}>{index + 1}</td>
                <td className={styles.nameCell}>
                  {row.avatar && <img src={row.avatar} alt='' className={styles.avatar} aria-hidden='true' />}
                  <span>{row.label}</span>
                  {row.is_team && <span className={styles.teamBadge} aria-label='Team'>Team</span>}
                </td>
                <td className={styles.statCell}>{toNumber(row.played)}</td>
                <td className={styles.statCell}>{toNumber(row.won)}</td>
                <td className={styles.statCell}>{toNumber(row.drew)}</td>
                <td className={styles.statCell}>{toNumber(row.lost)}</td>
                <td className={styles.statCell}>{toNumber(row.goals_for)}</td>
                <td className={styles.statCell}>{toNumber(row.goals_against)}</td>
                <td className={styles.statCell}>
                  {toNumber(row.goal_difference) > 0 ? '+' : ''}
                  {toNumber(row.goal_difference)}
                </td>
                <td className={styles.pointsCell}>{toNumber(row.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
