import { LoadingState } from '../../../components/ui';
import styles from './admin-tournaments.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading your tournaments...' />
        </div>
      </main>
    </div>
  );
}