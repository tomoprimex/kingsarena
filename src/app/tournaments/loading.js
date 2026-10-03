import { LoadingState } from '../../components/ui';
import styles from './tournaments.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading tournaments...' />
        </div>
      </main>
    </div>
  );
}