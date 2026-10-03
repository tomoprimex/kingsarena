import { LoadingState } from '../components/ui';
import styles from './page.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <div className={styles.container}>
          <LoadingState label='Loading Kings Arena...' />
        </div>
      </section>
    </div>
  );
}