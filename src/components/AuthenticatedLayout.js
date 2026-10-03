'use client';

import Sidebar from './Sidebar';
import styles from './AuthenticatedLayout.module.css';

export default function AuthenticatedLayout({ children }) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>{children}</div>
    </div>
  );
}