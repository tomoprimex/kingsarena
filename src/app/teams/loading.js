import { LoadingState } from '../../components/ui';
import styles from './teams.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading teams...' />
        </div>
      </main>
    </div>
  );
}