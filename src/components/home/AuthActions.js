'use client';

import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../app/page.module.css';

export default function AuthActions() {
  const { user, loading, signOut } = useAuth();

  // The session is resolved in an effect, so rendering anything before it settles
  // would produce markup that differs from the client and trigger a hydration mismatch.
  if (loading) return null;

  if (user) {
    return (
      <>
        <Link href="/dashboard" className={styles.dashboardBtn}>Dashboard</Link>
        <button type="button" onClick={signOut} className={styles.logoutBtn}>Logout</button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={styles.loginBtn}>Login</Link>
      <Link href="/signup" className={styles.signupBtn}>Join Arena</Link>
    </>
  );
}
