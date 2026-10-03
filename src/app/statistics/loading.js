import { LoadingState } from '../../components/ui';
import styles from './statistics.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading statistics...' />
        </div>
      </main>
    </div>
  );
}
