import { LoadingState } from '../../components/ui';
import styles from './community.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading members...' />
        </div>
      </main>
    </div>
  );
}
