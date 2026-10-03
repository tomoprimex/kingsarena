import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <span className={styles.icon}>👑</span>
        <h1 className={styles.title}>404</h1>
        <p className={styles.subtitle}>Page Not Found</p>
        <p className={styles.description}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className={styles.homeBtn}>Return Home</Link>
      </div>
    </div>
  );
}
