import { LoadingState } from '../../components/ui';
import styles from './rankings.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <LoadingState label='Loading rankings...' />
        </div>
      </main>
    </div>
  );
}
