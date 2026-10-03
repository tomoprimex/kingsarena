'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import styles from './Header.module.css';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/players', label: 'Players' },
  { href: '/teams', label: 'Teams' },
  { href: '/community', label: 'Community' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

export default function Header({ right }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>👑</span>
          <span className={styles.logoText}>KINGS ARENA</span>
        </Link>
        <nav className={styles.nav}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.userMenu}>
          {right ? right : null}
          {user && (
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
